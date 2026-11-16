import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import { drizzle } from "drizzle-orm/neon-http";
import * as s from "../src/db/schema";
import { sendDigest } from "../src/lib/push/digest";
import { HOUSING_TOTAL, NEWS_TOTAL } from "./global-setup";

// 요약 알림의 DB 흐름을 E2E 전용 DB에서 확인한다. 실제 푸시 서비스에는 보내지 않고 발송 함수를 바꿔 끼운다.
const db = drizzle(neon(process.env.E2E_DATABASE_URL!), { schema: s });
const vapid = { subject: "mailto:e2e@example.com", publicKey: "pub", privateKey: "priv" };
const sub = { endpoint: "https://push.example.com/digest-1", keys: { p256dh: "a", auth: "b" } };

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await db.delete(s.notificationSettings);
  await db.delete(s.pushSubscriptions);
  await db.insert(s.pushSubscriptions).values({ ...sub, userId: null });
});
test.afterAll(async () => {
  await db.delete(s.notificationSettings);
  await db.delete(s.pushSubscriptions);
});

const ok = async () => {};
const fail = async () => {
  throw Object.assign(new Error("boom"), { statusCode: 500 });
};

test("새 소식이 있으면 한 번 보내고, 바로 다시 실행하면 보낼 게 없다", async () => {
  const sent: string[] = [];
  const first = await sendDigest(db as never, vapid, new Date(), async (_s, payload) => {
    sent.push(payload);
  });
  expect(first.status).toBe("sent");
  if (first.status !== "sent") return;
  expect(first.counts.news).toBe(NEWS_TOTAL);
  expect(first.counts.housing).toBe(HOUSING_TOTAL);
  expect(sent).toHaveLength(1);
  expect(JSON.parse(sent[0]).title).toBe("오늘의 새 소식");

  const [row] = await db.select().from(s.notificationSettings);
  expect((row.rule as { lastDigestAt: string }).lastDigestAt).toBeTruthy();

  const second = await sendDigest(db as never, vapid, new Date(Date.now() + 1000), ok);
  expect(second.status).toBe("nothing_new");
});

test("끄면 보내지 않는다", async () => {
  await db.insert(s.notificationSettings).values({ userId: null, channel: "push", rule: {}, enabled: false });
  expect((await sendDigest(db as never, vapid, new Date(), ok)).status).toBe("disabled");
});

test("전부 실패하면 발송 시각을 옮기지 않아 다음에 다시 시도한다", async () => {
  const failed = await sendDigest(db as never, vapid, new Date(), fail);
  expect(failed.status).toBe("failed");
  const rows = await db.select().from(s.notificationSettings);
  expect(rows).toHaveLength(0);
  expect((await sendDigest(db as never, vapid, new Date(), ok)).status).toBe("sent");
});

test("받는 기기가 없으면 보내지 않는다", async () => {
  await db.delete(s.pushSubscriptions);
  expect((await sendDigest(db as never, vapid, new Date(), ok)).status).toBe("no_subscribers");
});

test("카테고리를 지정하면 그 카테고리 뉴스만 센다", async () => {
  const cats = await db.select().from(s.categories);
  const target = cats[0];
  await db.insert(s.notificationSettings).values({
    userId: null,
    channel: "push",
    rule: { categoryIds: [target.id], includeHousing: false },
    enabled: true,
  });
  const r = await sendDigest(db as never, vapid, new Date(), ok);
  expect(r.status).toBe("sent");
  if (r.status === "sent") {
    expect(r.counts.news).toBeGreaterThan(0);
    expect(r.counts.news).toBeLessThan(NEWS_TOTAL);
    expect(r.counts.housing).toBe(0);
  }
});
