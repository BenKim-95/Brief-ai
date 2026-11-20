import { expect, test } from "@playwright/test";
import { E2E_PREFIX, NEWS_MODEL_COUNT } from "./global-setup";

test("홈의 제목은 '뉴스 피드'이고 '나와 관련된 소식' 버튼이 있다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 2, name: "뉴스 피드" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "나와 관련된 소식", level: 2 })).toHaveCount(0);
  const nav = page.getByRole("navigation", { name: "둘러보기" });
  await expect(nav.getByRole("link", { name: "뉴스 피드" })).toHaveAttribute("aria-current", "page");
  await nav.getByRole("link", { name: "나와 관련된 소식" }).click();
  await expect(page).toHaveURL(/\/for-me$/);
  await expect(page.getByRole("heading", { level: 1, name: "나와 관련된 소식" })).toBeVisible();
});

test("관심 카테고리가 없으면 마이페이지로 안내한다", async ({ page }) => {
  await page.goto("/for-me");
  await expect(page.getByText("아직 관심 카테고리가 없어요")).toBeVisible();
  await page.getByRole("link", { name: "관심 카테고리 고르러 가기" }).click();
  await expect(page).toHaveURL(/\/my$/);
});

test("마이페이지에서 고른 카테고리의 소식만 모아 보여 준다", async ({ page }) => {
  await page.goto("/my");
  await page.getByRole("button", { name: `${E2E_PREFIX} 모델` }).click();
  const put = page.waitForResponse((r) => r.url().endsWith("/api/my/profile") && r.request().method() === "PUT");
  await page.getByRole("button", { name: "저장하기" }).click();
  expect((await put).status()).toBe(200);

  await page.goto("/for-me");
  await expect(page.getByText(`관심 카테고리: ${E2E_PREFIX} 모델`)).toBeVisible();
  const titles = page.getByRole("heading", { level: 3 });
  await expect(titles).toHaveCount(NEWS_MODEL_COUNT);
  for (const t of await titles.allTextContents()) expect(t).toContain("모델");
});

test("소식을 저장하면 저장한 소식과 같은 분야도 함께 보여 준다", async ({ page }) => {
  // 정책 소식 하나를 저장
  await page.goto("/");
  await page.getByRole("navigation", { name: "카테고리" }).getByRole("link", { name: `${E2E_PREFIX} 정책` }).click();
  await expect(page).toHaveURL(/category=\d+/);
  const put = page.waitForResponse((r) => /\/api\/saved\/\d+$/.test(r.url()) && r.request().method() === "PUT");
  await page.getByRole("button", { name: "☆ 저장" }).first().click();
  expect((await put).status()).toBe(200);

  await page.goto("/for-me");
  await expect(page.getByText(`저장한 소식과 같은 분야: ${E2E_PREFIX} 정책`)).toBeVisible();
  for (const t of await page.getByRole("heading", { level: 3 }).allTextContents()) expect(t).toContain("정책");

  const del = page.waitForResponse((r) => /\/api\/saved\/\d+$/.test(r.url()) && r.request().method() === "DELETE");
  await page.goto("/saved");
  await page.getByRole("button", { name: "★ 저장됨" }).click();
  expect((await del).status()).toBe(200);
});
