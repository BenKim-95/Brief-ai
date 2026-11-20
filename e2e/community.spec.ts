import { neon } from "@neondatabase/serverless";
import { expect, test, type Page } from "@playwright/test";
import { drizzle } from "drizzle-orm/neon-http";
import * as s from "../src/db/schema";
import { E2E_PREFIX } from "./global-setup";
import { ADMIN_TOKEN, signInAsAdmin } from "./helpers";

const db = drizzle(neon(process.env.E2E_DATABASE_URL!), { schema: s });

test.describe.configure({ mode: "serial" });
test.afterEach(async () => {
  // 다른 테스트에 글이 남지 않게 지운다.
  await db.delete(s.communityReports);
  await db.delete(s.communityComments);
  await db.delete(s.communityPosts);
  await db.delete(s.visitorProfiles);
});

async function writePost(page: Page, title: string, body: string) {
  await page.goto("/community/new");
  await page.getByLabel("제목").fill(title);
  await page.getByLabel("내용").fill(body);
  await page.getByRole("button", { name: "글 올리기" }).click();
  await expect(page).toHaveURL(/\/community\/\d+$/);
  // 글 화면이 그려질 때까지 기다린다(이전 화면은 숨겨진 채 남아 있을 수 있어서 '보이는 제목'으로 확인한다).
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
}

test("홈의 제보 기사 버튼으로 가면 빈 목록 안내가 보인다", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "둘러보기" }).getByRole("link", { name: "제보 기사" }).click();
  await expect(page).toHaveURL(/\/community$/);
  await expect(page.getByText("아직 올라온 글이 없어요")).toBeVisible();
});

test("글을 쓰면 목록에 보이고, 댓글을 주고받을 수 있다 (닉네임이 글쓴이로 나온다)", async ({ page, browser }) => {
  // 닉네임 정하기
  await page.goto("/my");
  await page.getByLabel("닉네임").fill("하늘");
  const put = page.waitForResponse((r) => r.url().endsWith("/api/my/profile") && r.request().method() === "PUT");
  await page.getByRole("button", { name: "저장하기" }).click();
  await put;

  await writePost(page, `${E2E_PREFIX} 첫 글`, "오늘 본 소식에 대해 이야기해요.\n둘째 줄이에요.");
  await expect(page.getByRole("heading", { level: 1, name: `${E2E_PREFIX} 첫 글` })).toBeVisible();
  await expect(page.getByText("하늘 ·").first()).toBeVisible();
  await expect(page.locator("article").getByText("둘째 줄이에요.")).toBeVisible();

  // 목록
  await page.goto("/community");
  const row = page.getByRole("link", { name: `${E2E_PREFIX} 첫 글` });
  await expect(row).toContainText("댓글 0");
  await row.click();

  // 다른 방문자가 댓글을 단다
  const other = await browser.newContext({ viewport: { width: 380, height: 800 } });
  try {
    const p2 = await other.newPage();
    await p2.goto(page.url());
    await expect(p2.getByRole("heading", { level: 1 })).toHaveText(`${E2E_PREFIX} 첫 글`);
    await p2.getByLabel("댓글 쓰기").fill("저도 궁금했어요!");
    await p2.getByRole("button", { name: "댓글 올리기" }).click();
    await expect(p2.getByText("저도 궁금했어요!")).toBeVisible();
    await expect(p2.getByRole("heading", { level: 2, name: "댓글 1개" })).toBeVisible();
    // 남이 쓴 글에는 신고가, 내가 쓴 댓글에는 지우기가 보인다
    await expect(p2.locator("article").getByRole("button", { name: "신고" })).toBeVisible();
    await expect(p2.locator("article").getByRole("button", { name: "지우기" })).toHaveCount(0);
    await expect(p2.getByRole("listitem").getByRole("button", { name: "지우기" })).toHaveCount(1);
  } finally {
    await other.close();
  }

  // 글쓴이에게 새 댓글이 보이고, 자기 글에는 신고 대신 지우기가 있다
  await page.reload();
  await expect(page.getByText("저도 궁금했어요!")).toBeVisible();
  await expect(page.getByRole("button", { name: "지우기" })).toHaveCount(1); // 글 하나(댓글은 남의 것)
});

test("내 글은 지울 수 있고, 남의 글은 지울 수 없다", async ({ page, browser, request }) => {
  await writePost(page, `${E2E_PREFIX} 지울 글`, "곧 지울 거예요.");
  const url = page.url();
  const id = url.split("/").pop();

  // 다른 방문자·로그인 없는 요청은 지우지 못한다
  const other = await browser.newContext();
  try {
    expect((await other.request.delete(`/api/community/posts/${id}`)).status()).toBe(404);
  } finally {
    await other.close();
  }
  expect((await request.delete(`/api/community/posts/${id}`)).status()).toBe(404);

  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "지우기" }).click();
  await expect(page).toHaveURL(/\/community$/);
  await expect(page.getByText("아직 올라온 글이 없어요")).toBeVisible();
});

test("입력이 잘못되면 이유를 보여 주고, 글쓰기 횟수에는 제한이 있다", async ({ page, request }) => {
  await page.goto("/community/new");
  await page.getByRole("button", { name: "글 올리기" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "제목을 써 주세요." })).toBeVisible();

  // 1시간에 5개까지 → 6번째는 429
  for (let i = 0; i < 5; i++) {
    const ok = await request.post("/api/community/posts", { data: { title: `도배 ${i}`, body: "내용" } });
    expect(ok.status()).toBe(201);
  }
  const blocked = await request.post("/api/community/posts", { data: { title: "도배 6", body: "내용" } });
  expect(blocked.status()).toBe(429);
  expect((await blocked.json()).error).toContain("1시간에 5개");
});

test("글 안의 HTML은 글자 그대로 보인다(실행되지 않는다)", async ({ page }) => {
  await writePost(page, `${E2E_PREFIX} <b>굵게</b>`, '<img src=x onerror="window.__xss=1"> <script>window.__xss=1</script>');
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${E2E_PREFIX} <b>굵게</b>`);
  await expect(page.locator("article").getByText('<img src=x onerror="window.__xss=1">')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
});

test("서로 다른 3명이 신고하면 글이 가려지고, 관리자가 되살릴 수 있다", async ({ page, browser }) => {
  await writePost(page, `${E2E_PREFIX} 신고될 글`, "신고 테스트예요.");
  const url = page.url();
  const id = Number(url.split("/").pop());

  // 자기 글은 신고할 수 없다
  expect((await page.request.post("/api/community/report", { data: { kind: "post", id } })).status()).toBe(400);

  const reporters = await Promise.all([0, 1, 2].map(() => browser.newContext()));
  try {
    for (const ctx of reporters) {
      const r = await ctx.request.post("/api/community/report", { data: { kind: "post", id } });
      expect(r.status()).toBe(200);
      // 같은 사람이 또 신고해도 1명으로 센다
      await ctx.request.post("/api/community/report", { data: { kind: "post", id } });
    }
  } finally {
    await Promise.all(reporters.map((c) => c.close()));
  }

  // 목록에서 사라지고, 상세는 '찾을 수 없어요'
  await page.goto("/community");
  await expect(page.getByText("아직 올라온 글이 없어요")).toBeVisible();
  await page.goto(url);
  await expect(page.getByText("찾을 수 없어요")).toBeVisible();

  // 관리자는 가려진 목록에서 되살린다
  const list = await page.request.get("/api/community/admin", { headers: { "x-admin-token": ADMIN_TOKEN } });
  expect(list.status()).toBe(200);
  expect(((await list.json()) as { id: number; reports: number }[]).find((x) => x.id === id)?.reports).toBe(3);
  expect((await page.request.get("/api/community/admin")).status()).toBe(401);
  await signInAsAdmin(page);
  await page.goto("/admin/community");
  await expect(page.getByText("신고 3명")).toBeVisible();
  await page.getByRole("button", { name: "되살리기" }).click();
  await expect(page.getByText("가려진 글이나 댓글이 없어요.")).toBeVisible();
  await page.goto("/community");
  await expect(page.getByRole("link", { name: `${E2E_PREFIX} 신고될 글` })).toBeVisible();
});

test("기사 화면에서 '이 소식으로 이야기 나누기'로 그 소식을 연결한 글을 쓴다", async ({ page, request }) => {
  const latest = ((await (await request.get("/api/widget/latest?limit=1")).json()).items as { id: number; title: string }[])[0];
  await page.goto(`/articles/${latest.id}`);
  await page.getByRole("link", { name: "이 소식으로 이야기 나누기" }).click();
  await expect(page.locator("form").getByText(latest.title)).toBeVisible();
  await page.getByLabel("제목").fill("연결된 글");
  await page.getByLabel("내용").fill("이 소식 어떻게 생각하세요?");
  await page.getByRole("button", { name: "글 올리기" }).click();
  await expect(page.getByRole("link", { name: latest.title })).toHaveAttribute("href", `/articles/${latest.id}`);
});
