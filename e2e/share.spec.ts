import { expect, test } from "@playwright/test";
import { E2E_PREFIX } from "./global-setup";

const title = `${E2E_PREFIX} 모델 소식 1`;
const card = (page: import("@playwright/test").Page) =>
  page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: title }) });

test("공유 버튼을 누르면 기기 공유 창에 이 기사의 주소와 제목이 넘어간다", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __shared?: unknown }).__shared = undefined;
    navigator.share = async (data) => {
      (window as unknown as { __shared?: unknown }).__shared = data;
    };
  });
  await page.goto("/");
  await card(page).getByRole("button", { name: "공유" }).click();
  const shared = await page.evaluate(() => (window as unknown as { __shared?: { url: string; title: string } }).__shared);
  expect(shared?.title).toBe(title);
  expect(shared?.url).toMatch(/\/articles\/\d+$/);
});

test("공유 창이 없는 브라우저에서는 링크를 복사하고 알려 준다", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  });
  await page.goto("/");
  await card(page).getByRole("button", { name: "공유" }).click();
  await expect(card(page).getByText("링크를 복사했어요.").last()).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toMatch(/\/articles\/\d+$/);
});

test("공유 창을 그냥 닫으면(취소) 오류나 복사 없이 조용히 끝난다", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.share = async () => {
      throw new DOMException("취소", "AbortError");
    };
  });
  await page.goto("/");
  await card(page).getByRole("button", { name: "공유" }).click();
  await expect(card(page).getByText("링크를 복사했어요.")).toHaveCount(0);
  await expect(card(page).getByRole("alert")).toHaveCount(0);
});

test("공유한 링크의 미리보기용 메타 정보(제목·요약)가 들어 있다", async ({ request }) => {
  const latest = await (await request.get("/api/widget/latest?limit=1")).json();
  const id = latest.items[0].id as number;
  const res = await request.get(`/articles/${id}`, { headers: { "user-agent": "Twitterbot/1.0" } });
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toContain('property="og:title"');
  expect(html).toContain(E2E_PREFIX);
  expect(html).toContain('property="og:description"');
});
