import { expect, test } from "@playwright/test";
import { E2E_PREFIX } from "./global-setup";

test("홈 위쪽에 마이페이지 버튼이 있고, 누르면 마이페이지로 간다", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "마이페이지" }).click();
  await expect(page).toHaveURL(/\/my$/);
  await expect(page.getByRole("heading", { level: 1, name: "마이페이지" })).toBeVisible();
});

test("닉네임과 관심 카테고리를 저장하면 새로고침해도 남고, 기사 없는 카테고리는 고를 수 없다", async ({ page }) => {
  await page.goto("/my");
  await expect(page.getByRole("button", { name: `${E2E_PREFIX} 빈 카테고리` })).toHaveCount(0);

  await page.getByLabel("닉네임").fill("하늘");
  await page.getByRole("button", { name: `${E2E_PREFIX} 모델` }).click();
  await expect(page.getByRole("button", { name: `${E2E_PREFIX} 모델` })).toHaveAttribute("aria-pressed", "true");
  const put = page.waitForResponse((r) => r.url().endsWith("/api/my/profile") && r.request().method() === "PUT");
  await page.getByRole("button", { name: "저장하기" }).click();
  expect((await put).status()).toBe(200);
  await expect(page.getByText("저장했어요.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("닉네임")).toHaveValue("하늘");
  await expect(page.getByRole("button", { name: `${E2E_PREFIX} 모델` })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: `${E2E_PREFIX} 정책` })).toHaveAttribute("aria-pressed", "false");
});

test("마이페이지는 방문자마다 따로고, 저장한 소식 개수가 보인다", async ({ browser }) => {
  const a = await browser.newContext({ viewport: { width: 380, height: 800 } });
  const b = await browser.newContext({ viewport: { width: 380, height: 800 } });
  try {
    const pa = await a.newPage();
    const pb = await b.newPage();
    await pa.goto("/");
    const put = pa.waitForResponse((r) => /\/api\/saved\/\d+$/.test(r.url()) && r.request().method() === "PUT");
    await pa.getByRole("button", { name: "☆ 저장" }).first().click();
    expect((await put).status()).toBe(200);
    await pa.goto("/my");
    await expect(pa.getByRole("link", { name: /저장한 소식/ })).toContainText("1");

    await pb.goto("/my");
    await expect(pb.getByRole("link", { name: /저장한 소식/ })).toContainText("0");
    await expect(pb.getByLabel("닉네임")).toHaveValue("");

    const del = pa.waitForResponse((r) => /\/api\/saved\/\d+$/.test(r.url()) && r.request().method() === "DELETE");
    await pa.goto("/saved");
    await pa.getByRole("button", { name: "★ 저장됨" }).click();
    expect((await del).status()).toBe(200);
  } finally {
    await a.close();
    await b.close();
  }
});

test("프로필 API는 잘못된 닉네임을 거절한다", async ({ request }) => {
  const res = await request.put("/api/my/profile", { data: { nickname: "가".repeat(13), interestCategoryIds: [] } });
  expect(res.status()).toBe(400);
});
