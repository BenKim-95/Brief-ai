import { expect, test } from "@playwright/test";
import { E2E_PREFIX, NEWS_MODEL_COUNT, NEWS_POLICY_COUNT, NEWS_TOTAL } from "./global-setup";
import { ADMIN_TOKEN, signInAsAdmin } from "./helpers";

const card = (page: import("@playwright/test").Page, title: string) =>
  page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: title }) });

test.beforeEach(async ({ page }) => {
  await signInAsAdmin(page);
});

test.describe("뉴스 카드", () => {
  test("카드가 최신순으로 6개씩 보이고 2페이지로 넘어간다", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(`지금까지 ${NEWS_TOTAL}개`);
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(6);
    await expect(page.getByRole("heading", { level: 3 }).first()).toHaveText(`${E2E_PREFIX} 모델 소식 1`);

    await page.getByRole("navigation", { name: "페이지" }).getByRole("link", { name: "2", exact: true }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(NEWS_TOTAL - 6);
  });

  test("카테고리 탭으로 해당 카테고리만 보인다", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "카테고리" }).getByRole("link", { name: `${E2E_PREFIX} 정책` }).click();
    await expect(page).toHaveURL(/category=\d+/);
    const titles = page.getByRole("heading", { level: 3 });
    await expect(titles).toHaveCount(NEWS_POLICY_COUNT);
    for (const t of await titles.allTextContents()) expect(t).toContain("정책");

    await page.getByRole("navigation", { name: "카테고리" }).getByRole("link", { name: `${E2E_PREFIX} 모델` }).click();
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(NEWS_MODEL_COUNT);
  });
});

test.describe("저장", () => {
  test("저장하면 저장함에 보이고, 해제하면 사라진다", async ({ page }) => {
    const title = `${E2E_PREFIX} 모델 소식 1`;
    await page.goto("/");
    const home = card(page, title);
    // 버튼은 누르는 즉시 ★로 바뀌므로(낙관적 갱신) 서버 저장이 끝난 뒤에 새로고침한다.
    const saved = page.waitForResponse((r) => /\/api\/saved\/\d+$/.test(r.url()) && r.request().method() === "PUT");
    await home.getByRole("button", { name: "☆ 저장" }).click();
    expect((await saved).status()).toBe(200);
    await expect(home.getByRole("button", { name: "★ 저장됨" })).toBeVisible();

    // 새로고침해도 유지된다 (서버에 저장됨)
    await page.reload();
    await expect(card(page, title).getByRole("button", { name: "★ 저장됨" })).toBeVisible();

    await page.getByRole("link", { name: "저장함" }).click();
    await expect(page).toHaveURL(/\/saved$/);
    await expect(page.getByRole("heading", { level: 3 })).toHaveText(title);

    await card(page, title).getByRole("button", { name: "★ 저장됨" }).click();
    await expect(page.getByText("저장한 소식이 없어요")).toBeVisible();
  });

  test("토큰이 없으면 저장되지 않고 이유를 알려준다", async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.removeItem("admin-token");
      } catch {}
    });
    await page.goto("/");
    const first = page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 3 }) }).first();
    await first.getByRole("button", { name: "☆ 저장" }).click();
    await expect(first.getByRole("alert")).toContainText("토큰");
    await expect(first.getByRole("button", { name: "☆ 저장" })).toBeVisible();
  });

  test("API는 토큰 없이 호출하면 401, 있는 기사만 저장된다", async ({ request }) => {
    expect((await request.put("/api/saved/1")).status()).toBe(401);
    const missing = await request.put("/api/saved/99999999", { headers: { "x-admin-token": ADMIN_TOKEN } });
    expect(missing.status()).toBe(404);
  });
});
