import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import { eq, inArray, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import * as s from "../src/db/schema";
import type { NoticeInput } from "../src/lib/housing/applyhome";
import { saveNotices } from "../src/lib/housing/sync";
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

test.describe("청약: 새 공고는 넣고, 일정이 바뀐 공고만 고친다", () => {
  let feedId = 0;
  const row = async (n: number) =>
    (await db.select().from(s.housingNotices).where(eq(s.housingNotices.externalId, `${EXT_PREFIX}${n}`)))[0];

  test.beforeAll(async () => {
    const [feed] = await db.insert(s.housingFeeds).values({ name: "[E2E] 중복 확인 피드", endpoint: FEED_ENDPOINT }).returning();
    feedId = feed.id;
  });
  test.afterAll(async () => {
    await db.delete(s.housingNotices).where(like(s.housingNotices.externalId, `${EXT_PREFIX}%`));
    await db.delete(s.housingFeeds).where(eq(s.housingFeeds.endpoint, FEED_ENDPOINT));
  });

  test("새 공고를 넣고, 똑같은 공고가 다시 오면 아무것도 쓰지 않는다", async () => {
    expect(await saveNotices(db as never, feedId, [notice(1), notice(2)])).toEqual({ inserted: 2, updated: 0, unchanged: 0 });
    const before = await row(1);
    expect(await saveNotices(db as never, feedId, [notice(1), notice(2)])).toEqual({ inserted: 0, updated: 0, unchanged: 2 });
    expect((await row(1)).updatedAt.getTime()).toBe(before.updatedAt.getTime());
  });

  test("일정이 아닌 항목(이름·공급 규모 등)만 달라진 공고는 건드리지 않는다", async () => {
    const before = await row(1);
    const r = await saveNotices(db as never, feedId, [notice(1, { name: "[E2E] 바뀐 이름", supplyCount: 999, address: "다른 주소" })]);
    expect(r).toEqual({ inserted: 0, updated: 0, unchanged: 1 });
    const after = await row(1);
    expect(after.name).toBe("[E2E] 중복 확인 단지 1");
    expect(after.supplyCount).toBe(100);
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
  });

  test("접수일이 바뀌면 일정만 고치고, 다른 항목은 그대로 둔다", async () => {
    const before = await row(1);
    const r = await saveNotices(db as never, feedId, [
      notice(1, { receiptStart: "2026-12-08", receiptEnd: "2026-12-10", name: "[E2E] 이름도 바뀜" }),
    ]);
    expect(r).toEqual({ inserted: 0, updated: 1, unchanged: 0 });
    const after = await row(1);
    expect(after.receiptStart).toBe("2026-12-08");
    expect(after.receiptEnd).toBe("2026-12-10");
    expect(after.winnerOn).toBe("2026-12-10");
    expect(after.name).toBe("[E2E] 중복 확인 단지 1"); // 일정이 아닌 항목은 덮어쓰지 않는다
    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });

  test("당첨자 발표일이나 모집공고일만 바뀌어도 반영한다", async () => {
    expect(await saveNotices(db as never, feedId, [notice(2, { winnerOn: "2026-12-20" })])).toEqual({ inserted: 0, updated: 1, unchanged: 0 });
    expect((await row(2)).winnerOn).toBe("2026-12-20");
    expect(await saveNotices(db as never, feedId, [notice(2, { winnerOn: "2026-12-20", announcedOn: "2026-10-25" })])).toEqual({
      inserted: 0,
      updated: 1,
      unchanged: 0,
    });
    expect((await row(2)).announcedOn).toBe("2026-10-25");
  });

  test("API가 일정을 비워서 보내도 저장된 일정을 지우지 않는다", async () => {
    const before = await row(1);
    const r = await saveNotices(db as never, feedId, [notice(1, { receiptStart: null, receiptEnd: null, winnerOn: null, announcedOn: null })]);
    expect(r).toEqual({ inserted: 0, updated: 0, unchanged: 1 });
    const after = await row(1);
    expect(after.receiptStart).toBe("2026-12-08");
    expect(after.winnerOn).toBe("2026-12-10");
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
  });

  test("새 공고, 일정이 바뀐 공고, 그대로인 공고가 섞여 와도 각각 센다(같은 공고가 두 번 와도 한 건)", async () => {
    const r = await saveNotices(db as never, feedId, [
      notice(1, { receiptStart: "2026-12-08", receiptEnd: "2026-12-10" }), // 그대로
      notice(2, { winnerOn: "2027-01-05", announcedOn: "2026-10-25" }), // 일정 변경
      notice(3), // 새 공고
      notice(3), // 같은 공고가 한 번 더
    ]);
    expect(r).toEqual({ inserted: 1, updated: 1, unchanged: 1 });
    expect(await db.select().from(s.housingNotices).where(like(s.housingNotices.externalId, `${EXT_PREFIX}%`))).toHaveLength(3);
  });
});

/** Claude 대신 쓰는 가짜. 제목 분류 요청과 번역·요약 요청을 구분해서 받은 제목을 기록한다. */
function fakeClaude(classifyByKeyword: (title: string) => number | null = () => null) {
  const enriched: string[] = [];
  const classified: string[] = [];
  const client = {
    messages: {
      create: async (args: { system: unknown; messages: { content: string }[] }) => {
        const text = args.messages[0].content;
        if (JSON.stringify(args.system).includes("카테고리로 나누는")) {
          const rows = [...text.matchAll(/\[key (\d+)\] ([^\n]*)/g)];
          for (const m of rows) classified.push(m[2]);
          const out = rows.map((m) => ({ key: Number(m[1]), categoryId: classifyByKeyword(m[2]) }));
          return { content: [{ type: "text", text: JSON.stringify(out) }], stop_reason: "end_turn" };
        }
        const rows = [...text.matchAll(/\[key (\d+)\][^\n]*\n제목: ([^\n]*)/g)];
        for (const m of rows) enriched.push(m[2]);
        const out = rows.map((m) => ({ key: Number(m[1]), titleKo: `[E2E] ${m[2]}`, summaryKo: "요약이에요.", categoryId: null }));
        return { content: [{ type: "text", text: JSON.stringify(out) }], stop_reason: "end_turn" };
      },
    },
  };
  return { client: client as never, raw: client, enriched, classified };
}

const rssXml = (base: string, items: { path: string; title: string; image?: string; at: string }[]) =>
  `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>test</title>${items
    .map(
      (i) =>
        `<item><title>${i.title}</title><link>${base}/news/${i.path}</link><description>${i.title} 발췌문</description><pubDate>${i.at}</pubDate>${
          i.image ? `<enclosure url="${i.image}" type="image/jpeg" length="1"/>` : ""
        }</item>`,
    )
    .join("")}</channel></rss>`;

const URL_PREFIX = "http://127.0.0.1";

test.describe("뉴스: 이미 저장된 기사는 Claude 에 보내지도 갱신하지도 않는다", () => {
  let server: Server;
  let base = "";
  let sourceId = 0;

  const items = [
    { path: "a", title: "서울 아파트 청약 일정이 발표됐어요", image: "https://img.example.com/a.jpg", at: "Tue, 17 Nov 2026 01:00:00 GMT" },
    { path: "b", title: "한국은행이 기준금리를 동결했어요", at: "Tue, 17 Nov 2026 01:01:00 GMT" },
    { path: "c", title: "국토교통부가 임대주택 공급을 늘려요", at: "Tue, 17 Nov 2026 01:02:00 GMT" },
  ];

  test.beforeAll(async () => {
    server = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/rss+xml; charset=utf-8" });
      res.end(rssXml(base, items));
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

  test("새 기사 2건만 Claude 로 보내 저장하고, 저장돼 있던 기사는 그대로 둔다", async () => {
    const { client, enriched, classified } = fakeClaude();
    const result = await syncNews(db as never, client);
    expect(result.sources.find((x) => x.id === sourceId)).toMatchObject({ ok: true, items: 3 });

    expect(enriched.sort()).toEqual([items[1].title, items[2].title].sort()); // a 는 보내지 않았다
    expect(classified).toHaveLength(0); // 한도(40) 안이라 제목 분류·선별은 하지 않는다
    expect(result.selectedByHotTopics).toBe(false);
    expect(result.inserted).toBe(2);

    const [a] = await db.select().from(s.articles).where(eq(s.articles.url, `${base}/news/a`));
    expect(a.titleKo).toBe("[E2E] 이미 저장된 기사");
    expect(a.summaryKo).toBe("처음 저장된 요약이에요.");
    expect(a.imageUrl).toBeNull(); // RSS 가 사진을 줘도 저장된 기사는 갱신하지 않는다
  });

  test("바로 다시 수집하면 새 기사가 없어서 Claude 도 부르지 않고 아무것도 늘지 않는다", async () => {
    const { client, enriched, classified } = fakeClaude();
    const result = await syncNews(db as never, client);
    expect(enriched).toHaveLength(0);
    expect(classified).toHaveLength(0);
    expect(result.newFound).toBe(0);
    expect(result.inserted).toBe(0);
    expect(await db.select().from(s.articles).where(like(s.articles.url, `${URL_PREFIX}%`))).toHaveLength(3);
  });
});

test.describe("뉴스: 새 기사가 한도보다 많으면 카테고리별 핫 토픽 순으로 고른다", () => {
  let server: Server;
  let base = "";
  const sourceIds: number[] = [];

  // 매체 1: 최신순으로 P1(정책), M2(모델), M1(모델), P2(정책). 매체 2는 M1·P2 와 같은 사건을 다룬다.
  const feed1 = [
    { path: "p1", title: "정책 지원 사업 공고가 새로 시작됐어요", at: "Tue, 17 Nov 2026 09:00:00 GMT" },
    { path: "m2", title: "모델 가격 인하 소식이 단독 보도됐어요", at: "Tue, 17 Nov 2026 08:00:00 GMT" },
    { path: "m1", title: "신규 에이전트 모델 출시 소식을 발표했어요", at: "Tue, 17 Nov 2026 03:00:00 GMT" },
    { path: "p2", title: "세제 개편안이 국회에 상정됐다는 정책 소식", at: "Tue, 17 Nov 2026 02:00:00 GMT" },
  ];
  const feed2 = [
    { path: "m1b", title: "신규 에이전트 모델 출시 소식을 공개했어요", at: "Tue, 17 Nov 2026 03:05:00 GMT" },
    { path: "p2b", title: "세제 개편안이 국회에 상정됐다는 정책 소식이에요", at: "Tue, 17 Nov 2026 02:05:00 GMT" },
  ];

  test.beforeAll(async () => {
    server = createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "application/rss+xml; charset=utf-8" });
      res.end(rssXml(base, req.url?.includes("rss2") ? feed2 : feed1));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `${URL_PREFIX}:${(server.address() as AddressInfo).port}`;
    const rows = await db
      .insert(s.sources)
      .values([
        { name: "[E2E] 핫 매체 1", url: `${base}/rss1.xml`, language: "ko" },
        { name: "[E2E] 핫 매체 2", url: `${base}/rss2.xml`, language: "ko" },
      ])
      .returning();
    sourceIds.push(...rows.map((r) => r.id));
  });

  test.afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.delete(s.articles).where(like(s.articles.url, `${URL_PREFIX}%`));
    if (sourceIds.length) await db.delete(s.sources).where(inArray(s.sources.id, sourceIds));
  });

  test("한도 3개: 카테고리마다 여러 매체가 다룬 이야기부터 돌아가며 고른다(최신순이 아니다)", async () => {
    const cats = await db.select().from(s.categories).orderBy(s.categories.sortOrder);
    const [catModel, catPolicy] = cats;
    const { client, enriched, classified } = fakeClaude((t) => (t.includes("모델") ? catModel.id : t.includes("정책") ? catPolicy.id : null));

    const result = await syncNews(db as never, client, { maxNew: 3 });

    // 같은 이야기를 두 매체가 쓴 M1·P2 는 중복 하나로 합쳐지고, 새 기사는 4건(P1, M2, M1, P2)
    expect(result.newFound).toBe(4);
    expect(result.selectedByHotTopics).toBe(true);
    expect(result.skippedByCap).toBe(1);
    expect(result.inserted).toBe(3);
    expect(classified).toHaveLength(4); // 선별을 위해 제목 4건을 분류했다

    // 모델: M1(매체 2곳) → M2 / 정책: P2(매체 2곳). 가장 최신인 P1 은 한 매체뿐이라 밀린다.
    const sent = enriched.join(" | ");
    expect(sent).toContain("출시 소식을");
    expect(sent).toContain("세제 개편안");
    expect(sent).toContain("가격 인하");
    expect(sent).not.toContain("지원 사업");
    const stored = await db.select().from(s.articles).where(like(s.articles.url, `${URL_PREFIX}%`));
    expect(stored).toHaveLength(3);
    expect(stored.some((a) => a.url.endsWith("/news/p1"))).toBe(false);
  });

  test("제목 분류가 실패해도 수집은 계속된다(분류 없이 핫함만으로 고르고, 이유를 알려준다)", async () => {
    // 위 테스트가 저장한 3건을 지우고 같은 상황을 다시 만든다.
    await db.delete(s.articles).where(like(s.articles.url, `${URL_PREFIX}%`));
    const real = fakeClaude();
    const failing = {
      messages: {
        create: async (args: { system: unknown; messages: { content: string }[] }) => {
          if (JSON.stringify(args.system).includes("카테고리로 나누는")) throw new Error("분류 호출 실패");
          return real.raw.messages.create(args);
        },
      },
    } as never;
    const result = await syncNews(db as never, failing, { maxNew: 3 });
    expect(result.selectedByHotTopics).toBe(true);
    expect(result.inserted).toBe(3);
    expect(result.failedBatches.join(" ")).toContain("제목 분류");
    // 분류 없이 핫함 순: 두 매체가 다룬 M1·P2 가 먼저, 남는 한 자리는 가장 최신(P1)
    const sent = real.enriched.join(" | ");
    expect(sent).toContain("출시 소식을");
    expect(sent).toContain("세제 개편안");
    expect(sent).toContain("지원 사업");
  });
});
