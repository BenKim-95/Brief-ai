import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import { asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import * as s from "../src/db/schema";

const db = drizzle(neon(process.env.E2E_DATABASE_URL!), { schema: s });

async function firstArticleId() {
  const [a] = await db.select({ id: s.articles.id }).from(s.articles).orderBy(asc(s.articles.id)).limit(1);
  return a.id;
}

const firstCard = (page: import("@playwright/test").Page) =>
  page.locator("li").filter({ has: page.getByRole("heading", { level: 3 }) }).first();

test.describe("읽을 시간 알림 (.ics)", () => {
  test("API: 미리 정한 시간으로 받으면 알림이 든 캘린더 파일이 온다", async ({ request }) => {
    const id = await firstArticleId();
    const res = await request.get(`/api/articles/${id}/ics?when=tomorrow`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/calendar");
    expect(res.headers()["content-disposition"]).toContain(`article-${id}.ics`);
    const body = await res.text();
    expect(body).toContain("BEGIN:VEVENT");
    expect(body).toContain("SUMMARY:[읽을 기사]");
    expect(body).toContain("BEGIN:VALARM");
    expect(body).toMatch(/DTSTART:\d{8}T\d{6}Z/);
    // 원문 링크와 요약만 담는다(본문 없음)
    expect(body).toMatch(/URL:https?:\/\//);
  });

  test("API: 날짜를 직접 고르면 그 날 오전 9시(한국 시간 = 같은 날 00:00Z)", async ({ request }) => {
    const id = await firstArticleId();
    const d = new Date(Date.now() + 10 * 86_400_000);
    const ymd = new Date(d.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
    const res = await request.get(`/api/articles/${id}/ics?date=${ymd}`);
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain(`DTSTART:${ymd.replace(/-/g, "")}T000000Z`);
  });

  test("API: 잘못된 요청은 이유와 함께 400, 없는 기사는 404", async ({ request }) => {
    const id = await firstArticleId();
    expect((await request.get(`/api/articles/${id}/ics`)).status()).toBe(400);
    expect((await request.get(`/api/articles/${id}/ics?when=noon`)).status()).toBe(400);
    expect((await request.get(`/api/articles/${id}/ics?when=evening&date=2030-01-01`)).status()).toBe(400);
    const past = await request.get(`/api/articles/${id}/ics?date=2020-01-01`);
    expect(past.status()).toBe(400);
    expect((await past.json()).error).toContain("지난 날");
    expect((await request.get(`/api/articles/99999999/ics?when=evening`)).status()).toBe(404);
    expect((await request.get(`/api/articles/abc/ics?when=evening`)).status()).toBe(400);
  });

  test("뉴스 카드에는 '읽을 시간 알림' 버튼이 없다(API는 그대로 있다)", async ({ page }) => {
    await page.goto("/");
    await expect(firstCard(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "읽을 시간 알림" })).toHaveCount(0);
  });
});
