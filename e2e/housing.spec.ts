import { expect, test } from "@playwright/test";
import { E2E_PREFIX, HOUSING_TOTAL } from "./global-setup";
import { signInAsAdmin } from "./helpers";

const title = `${E2E_PREFIX} 테스트 공고 A`;

test.beforeEach(async ({ page }) => {
  await signInAsAdmin(page);
});

test.describe("청약 정보", () => {
  test("공고 카드에 일정과 안내 문구가 보이고 지역 필터가 동작한다", async ({ page }) => {
    await page.goto("/housing");
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(HOUSING_TOTAL);
    const a = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });
    await expect(a).toContainText("접수 예정");
    await expect(a).toContainText("정확한 자격·일정은 청약홈 공고문을 확인해 주세요");
    // 투자 판단 표현이 없어야 한다 (PRD F11 문구 규칙)
    await expect(page.locator("main")).not.toContainText(/추천|유망|시세 차익/);

    await page.getByRole("navigation", { name: "지역" }).getByRole("link", { name: "서울" }).click();
    await expect(page).toHaveURL(/region=/);
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(HOUSING_TOTAL);
  });

  test(".ics 파일을 내려받을 수 있다", async ({ page }) => {
    await page.goto("/housing");
    const a = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      a.getByRole("link", { name: "캘린더에 추가" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.ics$/);
  });
});

test.describe("청약 저장", () => {
  test("저장하면 저장함에 보이고, 해제하면 사라진다", async ({ page }) => {
    await page.goto("/housing");
    const a = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });
    // 버튼은 누르는 즉시 ★로 바뀌므로(낙관적 갱신) 서버 저장이 끝난 뒤에 새로고침한다.
    const saved = page.waitForResponse((r) => /\/api\/housing\/saved\/\d+$/.test(r.url()) && r.request().method() === "PUT");
    await a.getByRole("button", { name: "☆ 저장" }).click();
    expect((await saved).status()).toBe(200);
    await expect(a.getByRole("button", { name: "★ 저장됨" })).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) }).getByRole("button", { name: "★ 저장됨" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "저장함" }).click();
    await expect(page).toHaveURL(/\/housing\/saved$/);
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(title);

    await page.getByRole("button", { name: "★ 저장됨" }).click();
    await expect(page.getByText("저장한 공고가 없어요")).toBeVisible();
  });

  test("API: 없는 공고는 404", async ({ request }) => {
    const missing = await request.put("/api/housing/saved/99999999");
    expect(missing.status()).toBe(404);
  });
});
