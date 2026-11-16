import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import { drizzle } from "drizzle-orm/neon-http";
import * as s from "../src/db/schema";
import { ADMIN_TOKEN, signInAsAdmin } from "./helpers";

const db = drizzle(neon(process.env.E2E_DATABASE_URL!), { schema: s });
const auth = { "x-admin-token": ADMIN_TOKEN };

test.describe.configure({ mode: "serial" });
test.beforeEach(async () => {
  await db.delete(s.emailSubscribers);
});
test.afterAll(async () => {
  await db.delete(s.emailSubscribers);
});

test.describe("이메일 구독 API", () => {
  test("토큰이 없으면 401 (수신 해제만 공개)", async ({ request }) => {
    expect((await request.get("/api/email/subscription")).status()).toBe(401);
    expect((await request.post("/api/email/subscription", { data: { email: "a@example.com" } })).status()).toBe(401);
    expect((await request.delete("/api/email/subscription", { data: { id: 1 } })).status()).toBe(401);
    expect((await request.post("/api/email/test")).status()).toBe(401);
  });

  test("잘못된 주소는 400, 같은 주소(대소문자 달라도)는 한 번만 저장되고 목록에 토큰은 없다", async ({ request }) => {
    expect((await request.post("/api/email/subscription", { headers: auth, data: { email: "not-an-email" } })).status()).toBe(400);

    const first = await request.post("/api/email/subscription", { headers: auth, data: { email: "Foo@Example.com" } });
    expect(first.status()).toBe(201);
    const again = await request.post("/api/email/subscription", { headers: auth, data: { email: "foo@example.com" } });
    expect(again.status()).toBe(200);
    expect(await again.json()).toEqual({ added: false });

    const list = await (await request.get("/api/email/subscription", { headers: auth })).json();
    expect(list.items).toHaveLength(1);
    expect(list.items[0].email).toBe("foo@example.com");
    expect(JSON.stringify(list)).not.toMatch(/token/i);

    const del = await request.delete("/api/email/subscription", { headers: auth, data: { id: list.items[0].id } });
    expect(del.status()).toBe(200);
    expect((await (await request.get("/api/email/subscription", { headers: auth })).json()).items).toHaveLength(0);
  });

  test("받는 주소는 20개까지", async ({ request }) => {
    await db.insert(s.emailSubscribers).values(
      Array.from({ length: 20 }, (_, i) => ({
        email: `u${i}@example.com`,
        unsubscribeToken: `limit-token-${i}-00000`,
        userId: null,
      })),
    );
    const res = await request.post("/api/email/subscription", { headers: auth, data: { email: "extra@example.com" } });
    expect(res.status()).toBe(409);
  });

  test("이메일 설정이 없으면 시험 메일은 503으로 이유를 알려준다", async ({ request }) => {
    const res = await request.post("/api/email/test", { headers: auth });
    expect(res.status()).toBe(503);
    expect((await res.json()).error).toContain("RESEND_API_KEY");
  });
});

test.describe("수신 해제", () => {
  test("메일 속 링크의 페이지에서 버튼을 눌러야 해제된다", async ({ page }) => {
    await db
      .insert(s.emailSubscribers)
      .values({ email: "bye@example.com", unsubscribeToken: "unsub-token-e2e-0000", userId: null });
    await page.goto("/email/unsubscribe?token=unsub-token-e2e-0000");
    // 페이지를 여는 것만으로는 지워지지 않는다
    await expect(page.getByRole("button", { name: "수신 해제" })).toBeVisible();
    expect(await db.select().from(s.emailSubscribers)).toHaveLength(1);
    await page.getByRole("button", { name: "수신 해제" }).click();
    await expect(page.getByRole("status")).toContainText("수신을 해제했어요");
    expect(await db.select().from(s.emailSubscribers)).toHaveLength(0);
  });

  test("토큰이 없거나 틀려도 오류를 드러내지 않고, 다른 사람의 주소는 지우지 않는다", async ({ page, request }) => {
    await db
      .insert(s.emailSubscribers)
      .values({ email: "stay@example.com", unsubscribeToken: "stay-token-e2e-00000", userId: null });
    await page.goto("/email/unsubscribe");
    await expect(page.getByText("링크가 올바르지 않아요")).toBeVisible();
    const res = await request.post("/api/email/unsubscribe", { data: { token: "totally-wrong-token-0000" } });
    expect(res.status()).toBe(200);
    expect(await db.select().from(s.emailSubscribers)).toHaveLength(1);
    expect((await request.post("/api/email/unsubscribe", { data: { token: "x" } })).status()).toBe(400);
  });
});

test("알림 설정 화면에서 주소를 추가하고 지울 수 있다", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/notifications");
  await page.getByLabel("이메일 주소").fill("ui@example.com");
  await page.getByRole("button", { name: "추가" }).click();
  await expect(page.getByText("ui@example.com", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "ui@example.com 삭제" }).click();
  await expect(page.getByText("ui@example.com", { exact: true })).toHaveCount(0);
});
