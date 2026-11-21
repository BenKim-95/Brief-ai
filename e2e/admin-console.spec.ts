import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import { count, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import * as s from "../src/db/schema";
import { ADMIN_TOKEN, signInAsAdmin } from "./helpers";

const db = drizzle(neon(process.env.E2E_DATABASE_URL!), { schema: s });
const admin = { "x-admin-token": ADMIN_TOKEN };
const BROWSER_UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";

test.describe.configure({ mode: "serial" });
test.afterEach(async () => {
  await db.delete(s.siteVisits);
});

const kstDay = (offset: number) => new Date(Date.now() + 9 * 3_600_000 + offset * 86_400_000).toISOString().slice(0, 10);

test.describe("관리자 잠금 화면", () => {
  test("처음 들어가면 잠겨 있고, 틀린 토큰은 거절하고, 맞는 토큰으로 풀면 대시보드가 열린다", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "관리자 잠금" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "오늘 현황" })).toHaveCount(0);
    const unlock = page.getByRole("button", { name: "잠금 해제" });
    await expect(unlock).toBeDisabled(); // 비어 있으면 누를 수 없다

    await page.getByLabel("관리 토큰").fill("wrong-token-value");
    await unlock.click();
    await expect(page.locator("#gate-error")).toContainText("토큰이 맞지 않아요");
    await expect(page.getByRole("heading", { name: "관리자 잠금" })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("admin-token"))).toBeFalsy(); // 틀린 토큰은 저장하지 않는다

    await page.getByLabel("관리 토큰").fill(ADMIN_TOKEN);
    await unlock.click();
    await expect(page.getByRole("heading", { name: "오늘 현황" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "관리 메뉴" })).toBeVisible();
    await expect(page.getByRole("button", { name: "청약 정보 가져오기" })).toBeVisible();

    // 새로 고침해도 이 브라우저에서는 잠금이 풀린 채로 있다
    await page.reload();
    await expect(page.getByRole("heading", { name: "오늘 현황" })).toBeVisible();
  });

  test("잠금 버튼을 누르면 다시 잠기고, 저장된 토큰도 지워진다", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "오늘 현황" })).toBeVisible();
    await page.getByRole("button", { name: "잠금", exact: true }).click();
    await expect(page.getByRole("heading", { name: "관리자 잠금" })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("admin-token"))).toBeFalsy();
  });

  test("하위 관리 화면도 토큰 없이는 내용 대신 잠금 화면이 나온다", async ({ page }) => {
    for (const path of ["/admin/traffic", "/admin/sources", "/admin/categories", "/admin/housing-feeds", "/admin/community"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "관리자 잠금" })).toBeVisible();
    }
  });

  test("토큰을 보이게/가리게 바꿀 수 있다", async ({ page }) => {
    await page.goto("/admin");
    const field = page.getByLabel("관리 토큰");
    await expect(field).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "토큰 보기" }).click();
    await expect(field).toHaveAttribute("type", "text");
  });

  test("위쪽 탭으로 화면을 옮겨 다닐 수 있다", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin");
    const tabs = page.getByRole("navigation", { name: "관리 메뉴 바로가기" });
    await tabs.getByRole("link", { name: "방문·트래픽" }).click();
    await expect(page).toHaveURL(/\/admin\/traffic$/);
    await expect(page.getByRole("heading", { name: "방문자·트래픽" })).toBeVisible();
    await expect(tabs.getByRole("link", { name: "방문·트래픽" })).toHaveAttribute("aria-current", "page");
    await tabs.getByRole("link", { name: "대시보드" }).click();
    await expect(page.getByRole("heading", { name: "오늘 현황" })).toBeVisible();
  });
});

test.describe("방문 기록 (하루 방문자수·트래픽)", () => {
  test("통계 API는 토큰 없이는 401", async ({ request }) => {
    expect((await request.get("/api/admin/traffic")).status()).toBe(401);
    expect((await request.get("/api/admin/traffic", { headers: { "x-admin-token": "nope" } })).status()).toBe(401);
  });

  test("방문 기록 API: 일반 화면은 세고, 관리 화면·API 경로·봇·다른 사이트 요청은 세지 않는다", async ({ request }) => {
    const headers = { "user-agent": BROWSER_UA };
    const post = (path: string, h: Record<string, string> = headers) => request.post("/api/analytics/visit", { data: { path }, headers: h });

    expect((await post("/five-minute?utm=x")).status()).toBe(204);
    expect((await post("/articles/12")).status()).toBe(204);
    expect((await post("/admin/errors")).status()).toBe(204);
    expect((await post("/api/news")).status()).toBe(204);
    expect((await post("/", { "user-agent": "Googlebot/2.1" })).status()).toBe(204);
    expect((await request.post("/api/analytics/visit", { data: { path: "/" }, headers: { ...headers, origin: "https://evil.example" } })).status()).toBe(403);
    expect((await request.post("/api/analytics/visit", { data: { nope: 1 }, headers })).status()).toBe(400);

    const rows = await db.select().from(s.siteVisits);
    expect(rows.map((r) => r.path).sort()).toEqual(["/articles/:id", "/five-minute"]); // 쿼리는 떼고 숫자는 :id
    expect(rows[0].day).toBe(kstDay(0));
    expect(rows[0].visitorId).toMatch(/^v:/);
    expect(new Set(rows.map((r) => r.visitorId)).size).toBe(1); // 같은 쿠키 = 같은 방문자

    const report = await (await request.get("/api/admin/traffic", { headers: admin })).json();
    expect(report.todayTotals).toMatchObject({ visitors: 1, pageViews: 2 });
    expect(report.daily).toHaveLength(14);
    expect(report.hourlyToday).toHaveLength(24);
  });

  test("일반 방문자가 화면을 열면 기록되고, 관리자(토큰 있음)와 /admin 은 기록되지 않는다", async ({ page }) => {
    await page.goto("/five-minute");
    await expect
      .poll(async () => (await db.select({ n: count() }).from(s.siteVisits).where(eq(s.siteVisits.path, "/five-minute")))[0].n)
      .toBe(1);

    await signInAsAdmin(page);
    await page.goto("/saved");
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "오늘 현황" })).toBeVisible();
    await page.waitForTimeout(800);
    const all = await db.select().from(s.siteVisits);
    expect(all.map((r) => r.path)).toEqual(["/five-minute"]);
  });

  test("방문자·트래픽 화면이 방문자수·페이지뷰·인기 화면을 보여 준다", async ({ page }) => {
    const today = kstDay(0);
    const yesterday = kstDay(-1);
    const rows = [
      { day: today, hour: 9, visitorId: "v:a", path: "/", source: "web" },
      { day: today, hour: 9, visitorId: "v:a", path: "/five-minute", source: "web" },
      { day: today, hour: 14, visitorId: "v:a", path: "/articles/:id", source: "web" },
      { day: today, hour: 14, visitorId: "v:b", path: "/", source: "app" },
      { day: yesterday, hour: 10, visitorId: "v:a", path: "/", source: "web" },
    ];
    await db.insert(s.siteVisits).values(rows);

    await signInAsAdmin(page);
    await page.goto("/admin/traffic");
    await expect(page.locator('[data-stat="오늘 방문자"]')).toHaveText("2");
    await expect(page.locator('[data-stat="오늘 페이지뷰"]')).toHaveText("4");
    await expect(page.getByText("처음 온 사람 1명")).toBeVisible();
    await expect(page.getByText("다시 온 사람 1명")).toBeVisible();
    await expect(page.getByText("어제보다 1 늘었어요")).toHaveCount(1); // 방문자: 어제 1명 → 오늘 2명
    await expect(page.getByText("어제보다 3 늘었어요")).toHaveCount(1); // 페이지뷰: 어제 1회 → 오늘 4회

    const top = page.locator('[data-top-path="/"]');
    await expect(top).toContainText("뉴스 피드");
    await expect(top).toContainText("3회 · 2명");
    await expect(page.locator('[data-top-path="/articles/:id"]')).toContainText("뉴스 상세");

    // 막대에 올리면 그 칸의 값이 글자로 나온다(오늘 시간대별: 14시대 페이지뷰 2회)
    await page.getByRole("button", { name: "14시대 페이지뷰 2회 (방문자 2명)" }).hover();
    await expect(page.locator("[data-chart-readout]").last()).toContainText("14시대 페이지뷰 2회");

    // 기간 바꾸기
    await page.getByRole("button", { name: "최근 30일" }).click();
    await expect(page.getByText("최근 30일 방문자")).toBeVisible();
    await expect(page.getByRole("button", { name: /11월|월 .*일\(.\) 방문자/ }).first()).toBeVisible();
  });

  test("대시보드의 오늘 현황 카드가 방문 통계를 보여 준다", async ({ page }) => {
    await db.insert(s.siteVisits).values([
      { day: kstDay(0), hour: 9, visitorId: "v:a", path: "/", source: "web" },
      { day: kstDay(0), hour: 10, visitorId: "v:b", path: "/", source: "web" },
    ]);
    await signInAsAdmin(page);
    await page.goto("/admin");
    await expect(page.locator('[data-stat="오늘 방문자"]')).toHaveText("2");
    await expect(page.locator('[data-stat="오늘 페이지뷰"]')).toHaveText("2");
    await expect(page.getByRole("heading", { name: "최근 7일 방문자" }).or(page.getByText("최근 7일 방문자")).first()).toBeVisible();
  });
});
