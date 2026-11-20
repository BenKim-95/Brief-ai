import { expect, test } from "@playwright/test";
import { E2E_PREFIX } from "./global-setup";
import { signInAsAdmin } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signInAsAdmin(page);
});

test("버튼을 누르고 기다리는 동안 화면 가운데에 로딩 안내가 보인다", async ({ page }) => {
  // 서버 응답이 느린 상황을 만든다.
  await page.route("**/api/articles/*/ics*", async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  await page.goto("/");
  const card = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: `${E2E_PREFIX} 모델 소식 1` }) });
  await card.getByRole("button", { name: "읽을 시간 알림" }).click();
  await card.getByRole("button", { name: /오늘 저녁|저녁/ }).first().click();

  const overlay = page.locator("[data-busy-overlay]");
  await expect(overlay).toBeVisible();
  await expect(overlay.getByRole("status")).toContainText("캘린더 파일을 만드는 중이에요");

  // 상자가 화면 가운데에 있다
  const box = await overlay.getByRole("status").boundingBox();
  const vp = page.viewportSize()!;
  expect(Math.abs(box!.x + box!.width / 2 - vp.width / 2)).toBeLessThan(4);
  expect(Math.abs(box!.y + box!.height / 2 - vp.height / 2)).toBeLessThan(4);

  // 끝나면 사라진다
  await expect(overlay).toHaveCount(0, { timeout: 8000 });
});

test("화면을 옮기는 동안에도 가운데 로딩 안내가 보인다", async ({ page }) => {
  // 이동하는 화면이 느린 상황(미리 받아 두는 요청도 함께 느리게)
  await page.route("**/saved**", async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });
  await page.goto("/");
  await page.getByRole("link", { name: "저장함" }).click();
  await expect(page.locator("[data-busy-overlay]")).toBeVisible();
  await expect(page.getByRole("heading", { name: "저장함" })).toBeVisible();
  await expect(page.locator("[data-busy-overlay]")).toHaveCount(0);
});
