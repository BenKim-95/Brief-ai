import { expect, test, type Page } from "@playwright/test";
import { ADMIN_TOKEN, signInAsAdmin } from "./helpers";

const settingsLink = (page: Page) => page.getByRole("link", { name: "설정", exact: true });
const fetchNews = (page: Page) => page.getByRole("button", { name: "뉴스 가져오기" });
const fetchHousing = (page: Page) => page.getByRole("button", { name: "청약 정보 가져오기" });
const tokenField = (page: Page) => page.getByLabel(/관리 토큰/);

/** 홈 목록까지 그려진 뒤(= 헤더의 클라이언트 코드도 실행된 뒤)의 상태를 본다. */
async function openHome(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible();
}

test.describe("홈: 관리자 전용 항목", () => {
  test("토큰이 없으면 설정·알림 버튼, 뉴스 가져오기, 토큰 입력칸이 모두 보이지 않는다(저장함은 보인다)", async ({ page }) => {
    await openHome(page);
    await expect(settingsLink(page)).toHaveCount(0);
    await expect(fetchNews(page)).toHaveCount(0);
    await expect(tokenField(page)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "저장함" })).toBeVisible();
    await expect(page.getByRole("link", { name: "알림", exact: true })).toHaveCount(0);
  });

  test("틀린 토큰이 저장돼 있어도 보이지 않는다", async ({ page }) => {
    await signInAsAdmin(page, "wrong-token-value");
    const checked = page.waitForResponse((r) => r.url().includes("/api/admin/check"));
    await openHome(page);
    expect((await checked).status()).toBe(401);
    await expect(settingsLink(page)).toHaveCount(0);
    await expect(fetchNews(page)).toHaveCount(0);
    await expect(tokenField(page)).toHaveCount(0);
  });

  test("맞는 토큰이 저장돼 있으면 설정 버튼과 뉴스 가져오기가 보이고, 설정을 누르면 관리 화면으로 간다", async ({ page }) => {
    await signInAsAdmin(page);
    await openHome(page);
    await expect(settingsLink(page)).toBeVisible();
    await expect(page.getByRole("link", { name: "알림", exact: true })).toBeVisible(); // 관리자에게만 보인다
    await expect(fetchNews(page)).toBeVisible();
    await expect(fetchNews(page)).toBeEnabled();
    await expect(tokenField(page)).toHaveCount(0); // 토큰이 이미 있으니 입력칸은 필요 없다
    await settingsLink(page).click();
    await expect(page).toHaveURL(/\/admin\/sources$/);
  });

  test("관리 화면에서 토큰을 입력하면 홈에 관리자 항목이 나타난다", async ({ page }) => {
    await openHome(page);
    await expect(fetchNews(page)).toHaveCount(0);
    await page.goto("/admin/sources");
    await tokenField(page).fill(ADMIN_TOKEN); // 입력하면 브라우저에 저장된다
    await page.goto("/");
    await expect(settingsLink(page)).toBeVisible();
    await expect(fetchNews(page)).toBeVisible();
  });

  test("토큰이 서버에서 거절되면(401) 관리자 항목이 다시 사라진다", async ({ page }) => {
    await signInAsAdmin(page);
    await openHome(page);
    await expect(settingsLink(page)).toBeVisible();
    await expect(fetchNews(page)).toBeVisible();
    // 다른 탭 등에서 토큰이 바뀐 상황
    await page.evaluate(() => {
      localStorage.setItem("admin-token", "changed-elsewhere");
      window.dispatchEvent(new Event("admin-token-change"));
    });
    await expect(settingsLink(page)).toHaveCount(0);
    await expect(fetchNews(page)).toHaveCount(0);
  });
});

test.describe("청약 화면: 청약 정보 가져오기", () => {
  test("토큰이 없으면 버튼과 토큰 입력칸이 보이지 않는다", async ({ page }) => {
    await page.goto("/housing");
    await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
    await expect(fetchHousing(page)).toHaveCount(0);
    await expect(tokenField(page)).toHaveCount(0);
  });

  test("맞는 토큰이면 보인다", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/housing");
    await expect(fetchHousing(page)).toBeVisible();
  });
});

test.describe("알림 화면: 토큰이 필요한 기능", () => {
  test("토큰이 없으면 알림 켜기·이메일 등록이 보이지 않고 안내만 나온다", async ({ page }) => {
    await page.goto("/notifications");
    await expect(page.getByRole("heading", { name: "알림 설정" })).toBeVisible();
    await expect(page.getByText("알림 설정은 관리자만 바꿀 수 있어요.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "이 기기로 알림 받기" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "이메일로 받기" })).toHaveCount(0);
    await expect(page.getByLabel("이메일 주소")).toHaveCount(0);
  });

  test("틀린 토큰이어도 안내만 나온다", async ({ page }) => {
    await signInAsAdmin(page, "wrong-token-value");
    await page.goto("/notifications");
    await expect(page.getByText("알림 설정은 관리자만 바꿀 수 있어요.")).toBeVisible();
    await expect(page.getByLabel("이메일 주소")).toHaveCount(0);
  });

  test("맞는 토큰이면 알림 켜기와 이메일 등록이 보이고 안내는 사라진다", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/notifications");
    await expect(page.getByRole("heading", { name: "이 기기로 알림 받기" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "이메일로 받기" })).toBeVisible();
    await expect(page.getByLabel("이메일 주소")).toBeVisible();
    await expect(page.getByText("알림 설정은 관리자만 바꿀 수 있어요.")).toHaveCount(0);
  });
});

test("확인 API는 토큰 없이는 401, 맞는 토큰이면 200", async ({ request }) => {
  expect((await request.get("/api/admin/check")).status()).toBe(401);
  expect((await request.get("/api/admin/check", { headers: { "x-admin-token": "nope" } })).status()).toBe(401);
  const ok = await request.get("/api/admin/check", { headers: { "x-admin-token": ADMIN_TOKEN } });
  expect(ok.status()).toBe(200);
  expect(await ok.json()).toEqual({ admin: true });
});
