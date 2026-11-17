import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import { eq, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import * as s from "../src/db/schema";
import type { NoticeInput } from "../src/lib/housing/applyhome";
import { insertNewNotices } from "../src/lib/housing/sync";
import { syncNews } from "../src/lib/news/sync";

// 자동 수집이 같은 기사·공고를 계속 다시 가져와도 "새 것만" 저장하는지 E2E 전용 DB에서 확인한다.
// 다른 테스트가 기사·공고 개수를 세므로, 이 파일이 만든 데이터는 끝날 때 반드시 지운다.
const db = drizzle(neon(process.env.E2E_DATABASE_URL!), { schema: s });
const EXT_PREFIX = "e2e-dedupe-";
const FEED_ENDPOINT = "e2e://dedupe-feed";

test.describe.configure({ mode: "serial" });

const notice = (n: number, over: Partial<NoticeInput> = {}): NoticeInput => ({
  externalId: `${EXT_PREFIX}${n}`,
  name: `[E2E] 중복 확인 단지 ${n}`,
  typeLabel: "APT",
  region: "서울",
  address: "서울특별시 예제로 1",
  supplyCount: 100,
  announcedOn: "2026-11-01",
  receiptStart: "2026-12-01",
  receiptEnd: "2026-12-03",
  winnerOn: "2026-12-10",
  detailUrl: "https://example.com/notice",
  raw: { n },
  ...over,
});

test.describe("청약: 이미 있는 공고는 건너뛰고 새 공고만 저장", () => {
  let feedId = 0;
  test.beforeAll(async () => {
    const [feed] = await db.insert(s.housingFeeds).values({ name: "[E2E] 중복 확인 피드", endpoint: FEED_ENDPOINT }).returning();
    feedId = feed.id;
  });
  test.afterAll(async () => {
    await db.delete(s.housingNotices).where(like(s.housingNotices.externalId, `${EXT_PREFIX}%`));
    await db.delete(s.housingFeeds).where(eq(s.housingFeeds.endpoint, FEED_ENDPOINT));
  });

  test("같은 공고가 다시 와도 내용을 덮어쓰지 않는다", async () => {
    const first = await insertNewNotices(db as never, feedId, [notice(1), notice(2)]);
    expect(first).toEqual({ inserted: 2, existing: 0 });
    const [before] = await db.select().from(s.housingNotices).where(eq(s.housingNotices.externalId, `${EXT_PREFIX}1`));

    // 같은 공고 번호에 이름·일정이 달라진 데이터가 와도 건너뛴다
    const again = await insertNewNotices(db as never, feedId, [
      notice(1, { name: "[E2E] 바뀐 이름", receiptStart: "2027-01-01", supplyCount: 999 }),
      notice(2),
    ]);
    expect(again).toEqual({ inserted: 0, existing: 2 });
    const [after] = await db.select().from(s.housingNotices).where(eq(s.housingNotices.externalId, `${EXT_PREFIX}1`));
    expect(after.name).toBe("[E2E] 중복 확인 단지 1");
    expect(after.receiptStart).toBe("2026-12-01");
    expect(after.supplyCount).toBe(100);
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
  });

  test("기존 공고와 새 공고가 섞여 오면 새 공고만 들어간다", async () => {
    const mixed = await insertNewNotices(db as never, feedId, [notice(1), notice(2), notice(3)]);
    expect(mixed).toEqual({ inserted: 1, existing: 2 });
    const rows = await db.select().from(s.housingNotices).where(like(s.housingNotices.externalId, `${EXT_PREFIX}%`));
    expect(rows).toHaveLength(3);
  });

  test("한 번에 같은 공고가 두 번 들어 있어도 한 건만 센다", async () => {
    const r = await insertNewNotices(db as never, feedId, [notice(4), notice(4)]);
    expect(r).toEqual({ inserted: 1, existing: 0 });
  });
});

test.describe("뉴스: 이미 저장된 기사는 Claude 에 보내지도 갱신하지도 않는다", () => {
  let server: Server;
  let base = "";
  let sourceId = 0;
  const URL_PREFIX = "http://127.0.0.1";

  const items = [
    { path: "a", title: "서울 아파트 청약 일정이 발표됐어요", image: "https://img.example.com/a.jpg" },
    { path: "b", title: "한국은행이 기준금리를 동결했어요" },
    { path: "c", title: "국토교통부가 임대주택 공급을 늘려요" },
  ];

  test.beforeAll(async () => {
    server = createServer((_req, res) => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>test</title>${items
        .map(
          (i) =>
            `<item><title>${i.title}</title><link>${base}/news/${i.path}</link><description>${i.title} 발췌문</description><pubDate>Tue, 17 Nov 2026 01:0${items.indexOf(i)}:00 GMT</pubDate>${
              i.image ? `<enclosure url="${i.image}" type="image/jpeg" length="1"/>` : ""
            }</item>`,
        )
        .join("")}</channel></rss>`;
      res.writeHead(200, { "Content-Type": "application/rss+xml; charset=utf-8" });
      res.end(xml);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `${URL_PREFIX}:${(server.address() as AddressInfo).port}`;
    const [src] = await db.insert(s.sources).values({ name: "[E2E] 로컬 RSS", url: `${base}/rss.xml`, language: "ko" }).returning();
    sourceId = src.id;
    // 기사 a 는 이미 저장돼 있다(사진 없음). 같은 RSS 가 사진을 줘도 채워 넣지 않아야 한다.
    await db.insert(s.articles).values({
      sourceId,
      url: `${base}/news/a`,
      titleOrig: items[0].title,
      titleKo: "[E2E] 이미 저장된 기사",
      summaryKo: "처음 저장된 요약이에요.",
      imageUrl: null,
      categoryId: null,
      publishedAt: new Date("2026-11-17T01:00:00Z"),
    });
  });

  test.afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.delete(s.articles).where(like(s.articles.url, `${URL_PREFIX}%`));
    await db.delete(s.sources).where(eq(s.sources.id, sourceId));
  });

  /** Claude 대신 받은 제목마다 한국어 제목·요약을 만들어 주고, 무엇을 받았는지 기록한다. */
  function fakeClaude() {
    const received: string[] = [];
    const client = {
      messages: {
        create: async (args: { messages: { content: string }[] }) => {
          const text = args.messages[0].content;
          const rows = [...text.matchAll(/\[key (\d+)\][^\n]*\n제목: ([^\n]*)/g)];
          for (const m of rows) received.push(m[2]);
          const out = rows.map((m) => ({
            key: Number(m[1]),
            titleKo: `[E2E] ${m[2]}`,
            summaryKo: "요약이에요.",
            categoryId: null,
          }));
          return { content: [{ type: "text", text: JSON.stringify(out) }], stop_reason: "end_turn" };
        },
      },
    };
    return { client: client as never, received };
  }

  test("새 기사 2건만 Claude 로 보내 저장하고, 저장돼 있던 기사는 그대로 둔다", async () => {
    const { client, received } = fakeClaude();
    const result = await syncNews(db as never, client);
    const mine = result.sources.find((x) => x.id === sourceId);
    expect(mine).toMatchObject({ ok: true, items: 3 });

    expect(received.sort()).toEqual([items[1].title, items[2].title].sort()); // a 는 보내지 않았다
    expect(result.inserted).toBe(2);

    const [a] = await db.select().from(s.articles).where(eq(s.articles.url, `${base}/news/a`));
    expect(a.titleKo).toBe("[E2E] 이미 저장된 기사");
    expect(a.summaryKo).toBe("처음 저장된 요약이에요.");
    expect(a.imageUrl).toBeNull(); // RSS 가 사진을 줘도 저장된 기사는 갱신하지 않는다
  });

  test("바로 다시 수집하면 새 기사가 없어서 Claude 도 부르지 않고 아무것도 늘지 않는다", async () => {
    const { client, received } = fakeClaude();
    const result = await syncNews(db as never, client);
    expect(received).toHaveLength(0);
    expect(result.newFound).toBe(0);
    expect(result.inserted).toBe(0);
    const rows = await db.select().from(s.articles).where(like(s.articles.url, `${URL_PREFIX}%`));
    expect(rows).toHaveLength(3);
  });
});
