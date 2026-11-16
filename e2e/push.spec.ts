import { expect, test } from "@playwright/test";
import { ADMIN_TOKEN } from "./helpers";

const auth = { "x-admin-token": ADMIN_TOKEN };
const endpoint = "https://push.example.com/e2e-endpoint-1";
const sub = { endpoint, keys: { p256dh: "e2e-p256dh", auth: "e2e-auth" } };

test.describe("웹 푸시 API", () => {
  test("토큰이 없으면 401", async ({ request }) => {
    expect((await request.post("/api/push/subscription", { data: sub })).status()).toBe(401);
    expect((await request.delete("/api/push/subscription", { data: { endpoint } })).status()).toBe(401);
    expect((await request.post("/api/push/test")).status()).toBe(401);
  });

  test("잘못된 구독은 400, 올바른 구독은 저장되고 같은 주소는 다시 저장해도 성공", async ({ request }) => {
    const bad = await request.post("/api/push/subscription", {
      headers: auth,
      data: { endpoint: "http://127.0.0.1/x", keys: sub.keys },
    });
    expect(bad.status()).toBe(400);

    for (let i = 0; i < 2; i++) {
      const ok = await request.post("/api/push/subscription", { headers: auth, data: sub });
      expect(ok.status()).toBe(200);
      expect(await ok.json()).toEqual({ subscribed: true });
    }
    const del = await request.delete("/api/push/subscription", { headers: auth, data: { endpoint } });
    expect(await del.json()).toEqual({ subscribed: false });
    // 없는 구독을 또 지워도 성공
    expect((await request.delete("/api/push/subscription", { headers: auth, data: { endpoint } })).status()).toBe(200);
  });

  test("푸시 키가 없으면 시험 알림은 503으로 이유를 알려준다", async ({ request }) => {
    const res = await request.post("/api/push/test", { headers: auth });
    expect(res.status()).toBe(503);
    expect((await res.json()).error).toContain("푸시 키");
  });

  test("알림 설정 화면이 열리고 홈에서 이어진다", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "알림" }).click();
    await expect(page).toHaveURL(/\/notifications$/);
    await expect(page.getByRole("heading", { name: "알림 설정" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "이 기기로 알림 받기" })).toBeVisible();
  });
});
