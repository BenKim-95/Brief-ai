import { expect, test } from "@playwright/test";
import { E2E_PREFIX, NEWS_MODEL_COUNT, NEWS_POLICY_COUNT, NEWS_TOTAL } from "./global-setup";
import { signInAsAdmin } from "./helpers";

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

  test("사진이 있는 카드만 사진을 보여주고, 열리지 않는 사진은 숨긴다", async ({ page }) => {
    await page.goto("/");
    // 소식 1: 정상 사진
    const withImage = card(page, `${E2E_PREFIX} 모델 소식 1`).locator("img");
    await expect(withImage).toBeVisible();
    await expect.poll(() => withImage.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
    // 소식 2: 주소가 깨져 있으면 사진 영역째 사라진다
    await expect(card(page, `${E2E_PREFIX} 모델 소식 2`).locator("img")).toHaveCount(0);
    // 소식 3: 사진 주소 자체가 없다
    await expect(card(page, `${E2E_PREFIX} 모델 소식 3`).locator("img")).toHaveCount(0);
    // 사진이 없거나 깨져도 제목·요약·저장 버튼은 그대로 있다
    await expect(card(page, `${E2E_PREFIX} 모델 소식 2`).getByRole("button", { name: "☆ 저장" })).toBeVisible();
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

  test("저장함에서 저장을 풀면 서버 응답을 기다리지 않고 카드가 바로 사라진다", async ({ page }) => {
    const title = `${E2E_PREFIX} 모델 소식 1`;
    await page.goto("/");
    const saved = page.waitForResponse((r) => /\/api\/saved\/\d+$/.test(r.url()) && r.request().method() === "PUT");
    await card(page, title).getByRole("button", { name: "☆ 저장" }).click();
    expect((await saved).status()).toBe(200);

    await page.goto("/saved");
    await expect(card(page, title)).toBeVisible();
    // 해제 요청을 일부러 늦춰도 카드는 곧바로 사라져야 한다.
    await page.route(/\/api\/saved\/\d+$/, async (route) => {
      if (route.request().method() === "DELETE") await new Promise((r) => setTimeout(r, 2000));
      await route.continue();
    });
    const deleted = page.waitForResponse((r) => /\/api\/saved\/\d+$/.test(r.url()) && r.request().method() === "DELETE");
    await card(page, title).getByRole("button", { name: "★ 저장됨" }).click();
    await expect(card(page, title)).toBeHidden({ timeout: 1000 });
    // 다른 테스트에 저장 상태가 남지 않도록 서버 해제가 끝날 때까지 기다린다.
    expect((await deleted).status()).toBe(200);
    await expect(page.getByText("저장한 소식이 없어요")).toBeVisible();
  });

  test("관리 토큰이 없는 방문자도 저장하고 저장을 풀 수 있다", async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.removeItem("admin-token");
      } catch {}
    });
    await page.goto("/");
    const first = page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 3 }) }).first();
    const title = (await first.getByRole("heading", { level: 3 }).textContent()) ?? "";
    const put = page.waitForResponse((r) => /\/api\/saved\/\d+$/.test(r.url()) && r.request().method() === "PUT");
    await first.getByRole("button", { name: "☆ 저장" }).click();
    expect((await put).status()).toBe(200);
    await expect(first.getByRole("button", { name: "★ 저장됨" })).toBeVisible();
    await expect(first.getByRole("alert")).toHaveCount(0);

    await page.goto("/saved");
    const savedCard = card(page, title);
    await expect(savedCard).toBeVisible();
    // 저장 취소 버튼은 눌러 볼 수 있고(비활성화 아님), 누르면 카드가 사라진다.
    const del = page.waitForResponse((r) => /\/api\/saved\/\d+$/.test(r.url()) && r.request().method() === "DELETE");
    const cancel = savedCard.getByRole("button", { name: "★ 저장됨" });
    await expect(cancel).toBeEnabled();
    await cancel.click();
    expect((await del).status()).toBe(200);
    await expect(page.getByText("저장한 소식이 없어요")).toBeVisible();
  });

  test("저장함은 방문자마다 따로다 (다른 브라우저에는 보이지 않는다)", async ({ browser }) => {
    const a = await browser.newContext({ viewport: { width: 380, height: 800 } });
    const b = await browser.newContext({ viewport: { width: 380, height: 800 } });
    try {
      const pa = await a.newPage();
      const pb = await b.newPage();
      await pa.goto("/");
      const first = pa.getByRole("listitem").filter({ has: pa.getByRole("heading", { level: 3 }) }).first();
      const put = pa.waitForResponse((r) => /\/api\/saved\/\d+$/.test(r.url()) && r.request().method() === "PUT");
      await first.getByRole("button", { name: "☆ 저장" }).click();
      expect((await put).status()).toBe(200);

      await pa.goto("/saved");
      await expect(pa.getByRole("heading", { level: 3 })).toHaveCount(1);

      // 다른 방문자: 저장함이 비어 있고 홈 카드에도 ★가 없다.
      await pb.goto("/saved");
      await expect(pb.getByText("저장한 소식이 없어요")).toBeVisible();
      await pb.goto("/");
      await expect(pb.getByRole("button", { name: "★ 저장됨" })).toHaveCount(0);

      // 뒷정리: 원래 방문자가 저장을 푼다.
      const del = pa.waitForResponse((r) => /\/api\/saved\/\d+$/.test(r.url()) && r.request().method() === "DELETE");
      await pa.getByRole("button", { name: "★ 저장됨" }).click();
      expect((await del).status()).toBe(200);
    } finally {
      await a.close();
      await b.close();
    }
  });

  test("다른 화면으로 옮기는 동안 상단 로딩바가 보였다가 사라진다", async ({ page }) => {
    // 이동이 빠르면 로딩바가 보이는 시간도 짧아서, 나타난 적이 있는지를 따로 기록해 둔다.
    await page.addInitScript(() => {
      const w = window as unknown as { __sawNavBar?: boolean };
      new MutationObserver(() => {
        if (document.querySelector("[data-nav-progress]")) w.__sawNavBar = true;
      }).observe(document, { childList: true, subtree: true });
    });
    await page.goto("/");
    await page.getByRole("link", { name: "저장함" }).click();
    await expect(page).toHaveURL(/\/saved$/);
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __sawNavBar?: boolean }).__sawNavBar === true))
      .toBe(true);
    // 이동이 끝나면 로딩바는 사라진다.
    await expect(page.locator("[data-nav-progress]")).toHaveCount(0, { timeout: 3000 });
  });

  test("API: 없는 기사는 404", async ({ request }) => {
    expect((await request.put("/api/saved/99999999")).status()).toBe(404);
  });
});
