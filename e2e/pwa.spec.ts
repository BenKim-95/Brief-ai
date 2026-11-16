import { expect, test } from "@playwright/test";

test.describe("PWA", () => {
  test("매니페스트와 아이콘이 있고 설치 조건을 갖춘다", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.ok()).toBe(true);
    const m = await res.json();
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/");
    for (const icon of m.icons) {
      const img = await request.get(icon.src);
      expect(img.ok(), icon.src).toBe(true);
      expect(img.headers()["content-type"]).toContain("image/png");
    }
  });

  test("서비스 워커 파일은 캐시되지 않고 /api 는 가로채지 않는다", async ({ request }) => {
    const res = await request.get("/sw.js");
    expect(res.ok()).toBe(true);
    expect(res.headers()["cache-control"]).toContain("no-cache");
    const body = await res.text();
    expect(body).toContain('startsWith("/api/")');
  });

  test("오프라인 안내 화면이 열린다", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByRole("heading", { name: "인터넷에 연결되어 있지 않아요" })).toBeVisible();
  });
});
