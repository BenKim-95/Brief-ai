import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import { drizzle } from "drizzle-orm/neon-http";
import * as s from "../src/db/schema";
import { sendDigest, type DigestDeps } from "../src/lib/push/digest";
import { HOUSING_TOTAL, NEWS_TOTAL } from "./global-setup";

// 요약 알림의 DB 흐름을 E2E 전용 DB에서 확인한다. 실제 푸시·메일 서비스에는 보내지 않고 발송 함수를 바꿔 끼운다.
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

type PushSend = NonNullable<DigestDeps["push"]>["send"];

const runPush = (send: PushSend, now = new Date()) =>
  sendDigest(db as never, { push: { vapid, send } }, now).then((o) => o.push!);

const ok = async () => {};
const fail = async () => {
  throw Object.assign(new Error("boom"), { statusCode: 500 });
};

test("새 소식이 있으면 한 번 보내고, 바로 다시 실행하면 보낼 게 없다", async () => {
  const sent: string[] = [];
  const first = await runPush(async (_s, payload) => {
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

  const second = await runPush(ok, new Date(Date.now() + 1000));
  expect(second.status).toBe("nothing_new");
});

test("끄면 보내지 않는다", async () => {
  await db.insert(s.notificationSettings).values({ userId: null, channel: "push", rule: {}, enabled: false });
  expect((await runPush(ok)).status).toBe("disabled");
});

test("전부 실패하면 발송 시각을 옮기지 않아 다음에 다시 시도한다", async () => {
  const failed = await runPush(fail);
  expect(failed.status).toBe("failed");
  expect(await db.select().from(s.notificationSettings)).toHaveLength(0);
  expect((await runPush(ok)).status).toBe("sent");
});

test("받는 기기가 없으면 보내지 않는다", async () => {
  await db.delete(s.pushSubscriptions);
  expect((await runPush(ok)).status).toBe("no_subscribers");
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
  const r = await runPush(ok);
  expect(r.status).toBe("sent");
  if (r.status === "sent") {
    expect(r.counts.news).toBeGreaterThan(0);
    expect(r.counts.news).toBeLessThan(NEWS_TOTAL);
    expect(r.counts.housing).toBe(0);
  }
});

// --- 이메일 채널 ---
const emailConfig = { apiKey: "re_e2e", from: "e2e@example.com", siteUrl: "https://brief.example.com" };
type Mail = { to: string; html: string; text: string; unsubscribeUrl: string };

async function runEmail(send: (c: typeof emailConfig, m: Mail[]) => Promise<void>, now = new Date()) {
  const o = await sendDigest(db as never, { email: { config: emailConfig, send: send as never } }, now);
  return o.email!;
}

test.describe("이메일 요약", () => {
  test.beforeEach(async () => {
    await db.delete(s.emailSubscribers);
    await db.insert(s.emailSubscribers).values([
      { email: "a@example.com", unsubscribeToken: "token-a-0000000000", userId: null },
      { email: "b@example.com", unsubscribeToken: "token-b-0000000000", userId: null },
    ]);
  });
  test.afterAll(async () => {
    await db.delete(s.emailSubscribers);
  });

  test("받는 사람마다 자기 수신 해제 링크가 든 메일을 한 번에 보낸다", async () => {
    let mails: Mail[] = [];
    const r = await runEmail(async (_c, m) => {
      mails = m;
    });
    expect(r.status).toBe("sent");
    expect(mails.map((m) => m.to)).toEqual(["a@example.com", "b@example.com"]);
    expect(mails[0].unsubscribeUrl).toContain("token-a-0000000000");
    expect(mails[0].html).not.toContain("token-b-0000000000");
    expect(mails[0].text).toContain("브리프 열기: https://brief.example.com");
    // 같은 날 다시 실행하면 보낼 게 없다
    expect((await runEmail(async () => {}, new Date(Date.now() + 1000))).status).toBe("nothing_new");
  });

  test("발송이 실패하면 발송 시각을 옮기지 않고, 푸시와 이력이 따로다", async () => {
    const failed = await runEmail(async () => {
      throw new Error("Resend 발송 실패 (500)");
    });
    expect(failed.status).toBe("failed");
    expect(await db.select().from(s.notificationSettings)).toHaveLength(0);

    expect((await runPush(ok)).status).toBe("sent");
    expect((await runEmail(async () => {})).status).toBe("sent");
    const rows = await db.select().from(s.notificationSettings);
    expect(rows.map((r) => r.channel).sort()).toEqual(["email", "push"]);
  });

  test("받는 주소가 없으면 보내지 않는다", async () => {
    await db.delete(s.emailSubscribers);
    expect((await runEmail(async () => {})).status).toBe("no_subscribers");
  });
});
