import { expect, test, type Page } from "@playwright/test";
import { ADMIN_TOKEN, signInAsAdmin } from "./helpers";

const settingsLink = (page: Page) => page.getByRole("link", { name: "설정", exact: true });

/** 홈 목록까지 그려진 뒤(= 헤더의 클라이언트 코드도 실행된 뒤)의 상태를 본다. */
async function openHome(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible();
}

test.describe("홈의 '설정' 버튼은 관리자에게만 보인다", () => {
  test("토큰이 없으면 보이지 않는다(저장함·알림은 그대로 보인다)", async ({ page }) => {
    await openHome(page);
    await expect(settingsLink(page)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "저장함" })).toBeVisible();
    await expect(page.getByRole("link", { name: "알림", exact: true })).toBeVisible();
  });

  test("틀린 토큰이 저장돼 있어도 보이지 않는다", async ({ page }) => {
    await signInAsAdmin(page, "wrong-token-value");
    const checked = page.waitForResponse((r) => r.url().includes("/api/admin/check"));
    await openHome(page);
    expect((await checked).status()).toBe(401);
    await expect(settingsLink(page)).toHaveCount(0);
  });

  test("맞는 토큰이 저장돼 있으면 보이고, 누르면 관리 화면으로 간다", async ({ page }) => {
    await signInAsAdmin(page);
    await openHome(page);
    await expect(settingsLink(page)).toBeVisible();
    await settingsLink(page).click();
    await expect(page).toHaveURL(/\/admin\/sources$/);
  });

  test("홈에서 토큰을 입력하면 그 자리에서 나타난다", async ({ page }) => {
    await openHome(page);
    await expect(settingsLink(page)).toHaveCount(0);
    await page.getByLabel(/관리 토큰/).fill(ADMIN_TOKEN);
    await expect(settingsLink(page)).toBeVisible();
  });

  test("토큰이 서버에서 거절되면(401) 버튼이 다시 사라진다", async ({ page }) => {
    await signInAsAdmin(page);
    await openHome(page);
    await expect(settingsLink(page)).toBeVisible();
    // 다른 탭 등에서 토큰이 지워지거나 바뀐 상황
    await page.evaluate(() => {
      localStorage.setItem("admin-token", "changed-elsewhere");
      window.dispatchEvent(new Event("admin-token-change"));
    });
    await expect(settingsLink(page)).toHaveCount(0);
  });

  test("확인 API는 토큰 없이는 401, 맞는 토큰이면 200", async ({ request }) => {
    expect((await request.get("/api/admin/check")).status()).toBe(401);
    expect((await request.get("/api/admin/check", { headers: { "x-admin-token": "nope" } })).status()).toBe(401);
    const ok = await request.get("/api/admin/check", { headers: { "x-admin-token": ADMIN_TOKEN } });
    expect(ok.status()).toBe(200);
    expect(await ok.json()).toEqual({ admin: true });
  });
});
