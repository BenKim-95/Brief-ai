import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import { drizzle } from "drizzle-orm/neon-http";
import * as s from "../src/db/schema";
import { E2E_PREFIX } from "./global-setup";

const db = drizzle(neon(process.env.E2E_DATABASE_URL!), { schema: s });

test.describe.configure({ mode: "serial" });
// 다른 테스트가 기사를 열어 남긴 조회 기록이 순위에 섞이지 않게, 앞뒤로 비운다.
test.beforeEach(async () => {
  await db.delete(s.articleViews);
});
test.afterEach(async () => {
  await db.delete(s.articleViews);
});

test("5분 이슈 화면: 분야별 1개씩 모은 5개가 보이고, 홈에서 버튼으로 올 수 있다", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "둘러보기" }).getByRole("link", { name: "5분 이슈" }).click();
  await expect(page).toHaveURL(/\/five-minute$/);
  await expect(page.getByRole("heading", { level: 1, name: "5분 이슈" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3 })).toHaveCount(5);
  // 분야(모델·정책)가 2개뿐이라 앞의 두 자리는 서로 다른 분야다.
  const badges = await page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 3 }) }).locator("p.text-xs span.font-bold").allTextContents();
  expect(new Set(badges.slice(0, 2)).size).toBe(2);
  await expect(page.getByText("오늘은 아직 본 사람이 적어서")).toBeVisible();
});

test("조회수가 쌓이면 그 분야 대표가 바뀌고, 많이 본 분야가 앞으로 온다", async ({ page, request }) => {
  const latest = (await (await request.get("/api/widget/latest?limit=5")).json()).items as { id: number; title: string }[];
  const policy = latest.find((x) => x.title.includes("정책"))!;
  expect(policy).toBeTruthy();

  // 같은 방문자가 여러 번 열어도 하루 1회만 센다.
  const first = await (await request.post(`/api/articles/${policy.id}/view`)).json();
  const again = await (await request.post(`/api/articles/${policy.id}/view`)).json();
  expect(first.counted).toBe(true);
  expect(again.counted).toBe(false);
  expect((await request.post("/api/articles/99999999/view")).status()).toBe(404);

  await page.goto("/five-minute");
  const firstCard = page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 3 }) }).first();
  await expect(firstCard.getByRole("heading", { level: 3 })).toHaveText(policy.title);
  await expect(page.getByText("오늘 1명이 봤어요")).toBeVisible();
  await expect(page.getByText("오늘은 아직 본 사람이 적어서")).toHaveCount(0);
});

test("원문 보기를 누르면 조회로 센다", async ({ page, context }) => {
  await page.goto("/");
  const card = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: `${E2E_PREFIX} 모델 소식 2` }) });
  const beacon = page.waitForRequest((r) => /\/api\/articles\/\d+\/view$/.test(r.url()) && r.method() === "POST");
  const popup = context.waitForEvent("page");
  await card.getByRole("link", { name: /원문 보기/ }).click();
  await beacon;
  await (await popup).close();
});

test("기사 한 건 화면을 열면 조회로 센다", async ({ page, request }) => {
  const id = ((await (await request.get("/api/widget/latest?limit=1")).json()).items as { id: number }[])[0].id;
  const beacon = page.waitForRequest((r) => r.url().endsWith(`/api/articles/${id}/view`) && r.method() === "POST");
  await page.goto(`/articles/${id}`);
  await beacon;
});
