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

const notifLink = (page: Page) => page.getByRole("link", { name: "알림", exact: true });

test.describe("홈에는 관리자 버튼이 없다 (알림·설정·뉴스 가져오기는 관리 메뉴에만)", () => {
  test("토큰이 없어도, 맞는 토큰이 저장돼 있어도 홈에는 설정·알림·뉴스 가져오기·토큰 입력칸이 없다", async ({ page }) => {
    await openHome(page);
    for (const loc of [settingsLink(page), notifLink(page), fetchNews(page), tokenField(page)]) await expect(loc).toHaveCount(0);
    await expect(page.getByRole("link", { name: "저장함" })).toBeVisible();

    await signInAsAdmin(page);
    await openHome(page);
    await page.waitForTimeout(800); // 관리자 확인(/api/admin/check)이 끝나고도 나타나지 않는지 본다
    for (const loc of [settingsLink(page), notifLink(page), fetchNews(page), tokenField(page)]) await expect(loc).toHaveCount(0);
  });
});

test.describe("관리 메뉴(/admin): 관리자만 보고 쓸 수 있다", () => {
  test("뉴스 가져오기 버튼은 관리 대시보드에만 있고(청약 버튼 아래), 홈에는 없다. AI 해설 채우기 버튼은 어디에도 없다", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin");
    await expect(fetchHousing(page)).toBeVisible();
    await expect(fetchNews(page)).toBeVisible();
    const housingBox = (await fetchHousing(page).boundingBox())!;
    const newsBox = (await fetchNews(page).boundingBox())!;
    expect(newsBox.y).toBeGreaterThan(housingBox.y); // 청약 버튼 밑
    await page.goto("/");
    await page.waitForTimeout(800);
    await expect(fetchNews(page)).toHaveCount(0);
    for (const path of ["/admin", "/"]) {
      await page.goto(path);
      await expect(page.getByRole("button", { name: /AI 해설 채우기/ })).toHaveCount(0);
    }
  });

  test("뉴스 가져오기를 누르면 서버에 요청하고 결과(여기서는 키가 없다는 안내)를 보여 준다", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin");
    const requested = page.waitForResponse((r) => r.url().endsWith("/api/news/fetch") && r.request().method() === "POST");
    await fetchNews(page).click();
    expect((await requested).status()).toBe(503); // E2E 는 Claude 키를 비워 두므로 실제 호출 없이 503
    await expect(page.getByText(/ANTHROPIC_API_KEY/)).toBeVisible();
    await expect(fetchNews(page)).toBeEnabled();
  });

  test("토큰이 없으면 버튼이 보이지 않고 안내만 나온다", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByText("관리자만 쓸 수 있는 화면이에요")).toBeVisible();
    await expect(fetchHousing(page)).toHaveCount(0);
    await expect(page.getByRole("link", { name: /알림 설정/ })).toHaveCount(0);
  });

  test("틀린 토큰이어도 보이지 않는다", async ({ page }) => {
    await signInAsAdmin(page, "wrong-token-value");
    await page.goto("/admin");
    await expect(page.getByText("관리자만 쓸 수 있는 화면이에요")).toBeVisible();
    await expect(fetchHousing(page)).toHaveCount(0);
  });

  test("관리 화면에서 토큰을 입력하면 청약 정보 가져오기와 알림 설정이 나타난다", async ({ page }) => {
    await page.goto("/admin");
    await expect(fetchHousing(page)).toHaveCount(0);
    await tokenField(page).fill(ADMIN_TOKEN);
    await page.getByRole("button", { name: "잠금 해제" }).click(); // 서버가 토큰을 확인하면 열리고 브라우저에 저장된다
    await expect(fetchHousing(page)).toBeVisible();
    await expect(fetchHousing(page)).toBeEnabled();
    await page.getByRole("link", { name: /알림 설정/ }).first().click();
    await expect(page).toHaveURL(/\/notifications$/);
  });

  test("토큰이 서버에서 거절되면(401) 버튼이 다시 사라진다", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin");
    await expect(fetchHousing(page)).toBeVisible();
    await page.evaluate(() => {
      localStorage.setItem("admin-token", "changed-elsewhere");
      window.dispatchEvent(new Event("admin-token-change"));
    });
    await expect(fetchHousing(page)).toHaveCount(0);
  });

  test("뉴스 가져오기·AI 해설 API는 토큰 없이는 401 (버튼을 숨겨도 직접 호출은 막힌다)", async ({ request }) => {
    expect((await request.post("/api/news/fetch")).status()).toBe(401);
    expect((await request.post("/api/news/insights")).status()).toBe(401);
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
