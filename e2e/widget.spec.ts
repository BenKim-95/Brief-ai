import { expect, test } from "@playwright/test";
import { E2E_PREFIX } from "./global-setup";

test.describe("위젯용 API와 기사 화면", () => {
  test("최신 뉴스를 기본 3개, 앱 안 경로와 함께 내려준다(토큰 없이)", async ({ request }) => {
    const res = await request.get("/api/widget/latest");
    expect(res.status()).toBe(200);
    expect(res.headers()["cache-control"]).toContain("max-age");
    const { items } = await res.json();
    expect(items).toHaveLength(3);
    for (const it of items) {
      expect(it.title).toContain(E2E_PREFIX);
      expect(it.path).toBe(`/articles/${it.id}`);
      expect(Array.from(it.summary as string).length).toBeLessThanOrEqual(80);
      expect(Object.keys(it).sort()).toEqual(["category", "id", "path", "publishedAt", "source", "summary", "title"]);
    }
    // 최신순
    const times = items.map((i: { publishedAt: string }) => Date.parse(i.publishedAt));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  test("limit 으로 개수를 정하고, 범위 밖이면 400", async ({ request }) => {
    expect((await (await request.get("/api/widget/latest?limit=5")).json()).items).toHaveLength(5);
    expect((await (await request.get("/api/widget/latest?limit=1")).json()).items).toHaveLength(1);
    expect((await request.get("/api/widget/latest?limit=6")).status()).toBe(400);
    expect((await request.get("/api/widget/latest?limit=x")).status()).toBe(400);
  });

  test("위젯이 알려 준 경로로 기사 한 건 화면이 열린다", async ({ page, request }) => {
    const { items } = await (await request.get("/api/widget/latest?limit=1")).json();
    await page.goto(items[0].path);
    await expect(page.getByRole("heading", { level: 3 })).toContainText(items[0].title);
    await expect(page.getByRole("link", { name: /원문 보기/ })).toBeVisible();
  });

  test("없거나 잘못된 기사 번호는 '찾을 수 없어요' 화면(스트리밍이라 상태 코드는 200일 수 있다)", async ({ page }) => {
    for (const path of ["/articles/99999999", "/articles/abc"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "찾을 수 없어요" })).toBeVisible();
      await expect(page.getByRole("link", { name: /원문 보기/ })).toHaveCount(0);
    }
  });
});
