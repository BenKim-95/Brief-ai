import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import * as s from "../src/db/schema";
import { errorCode } from "../src/lib/errors/code";
import { ADMIN_TOKEN, signInAsAdmin } from "./helpers";

const db = drizzle(neon(process.env.E2E_DATABASE_URL!), { schema: s });

test.describe.configure({ mode: "serial" });
test.afterEach(async () => {
  await db.delete(s.errorEvents);
});

const admin = { "x-admin-token": ADMIN_TOKEN };

test.describe("관리자 화면은 관리자만", () => {
  test("토큰이 없으면 안내만 보이고, 관리 메뉴·오류 화면 내용은 보이지 않는다", async ({ page }) => {
    await page.goto("/admin/errors");
    await expect(page.getByText("관리자만 쓸 수 있는 화면이에요")).toBeVisible();
    await expect(page.getByRole("heading", { name: "오류 코드·이슈 현황" })).toHaveCount(0);
    await page.goto("/admin");
    await expect(page.getByText("관리자만 쓸 수 있는 화면이에요")).toBeVisible();
    await expect(page.getByRole("link", { name: /오류 코드·이슈 현황/ })).toHaveCount(0);
  });

  test("토큰이 있으면 관리 메뉴가 보이고 오류 화면으로 갈 수 있다", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "관리 메뉴" })).toBeVisible();
    // 뉴스 가져오기·AI 해설 채우기 버튼은 숨겼고, 청약 정보 가져오기와 알림 설정은 관리 메뉴에 있다.
    await expect(page.getByRole("button", { name: "뉴스 가져오기" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /AI 해설 채우기/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "청약 정보 가져오기" })).toBeVisible();
    await expect(page.getByRole("link", { name: "알림 설정" }).first()).toBeVisible();
    await page.getByRole("link", { name: /오류 코드·이슈 현황/ }).click();
    await expect(page).toHaveURL(/\/admin\/errors$/);
    await expect(page.getByRole("heading", { name: "오류 코드·이슈 현황" })).toBeVisible();
  });

  test("오류 API는 토큰 없이는 401", async ({ request }) => {
    expect((await request.get("/api/admin/errors")).status()).toBe(401);
    expect((await request.patch("/api/admin/errors/1", { data: { status: "resolved" } })).status()).toBe(401);
    expect((await request.delete("/api/admin/errors/1")).status()).toBe(401);
  });
});

test.describe("오류 보고와 오류 코드", () => {
  test("웹 오류를 보내면 코드가 돌아오고, 같은 원인은 한 줄로 합쳐져 횟수가 오른다", async ({ request }) => {
    const send = (message: string, path = "/articles/3") =>
      request.post("/api/errors", { data: { source: "web", message, path: `${path}?q=secret`, userAgent: "E2E" } });
    const a = await send("article 11 failed");
    expect(a.status()).toBe(202);
    const { code } = await a.json();
    expect(code).toBe(errorCode("web", "article 11 failed", "/articles/3"));
    expect(code).toMatch(/^E-WEB-[0-9A-Z]{5}$/);
    // 숫자·글 번호만 다른 같은 원인
    expect((await (await send("article 12 failed", "/articles/9")).json()).code).toBe(code);

    const list = await (await request.get("/api/admin/errors", { headers: admin })).json();
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({ code, source: "web", count: 2, status: "open", path: "/articles/:id" });
    expect(list.summary.open).toBe(1);
    expect(list.summary.last24h.web).toBe(1);
    // 쿼리(q=secret)는 저장하지 않는다
    expect(JSON.stringify(list.items)).not.toContain("secret");
  });

  test("잘못된 보고·서버 출처 위장·다른 사이트에서 온 요청은 거절한다", async ({ request }) => {
    expect((await request.post("/api/errors", { data: { source: "server", message: "x" } })).status()).toBe(400);
    expect((await request.post("/api/errors", { data: { source: "web", message: "   " } })).status()).toBe(400);
    expect((await request.post("/api/errors", { data: "not json", headers: { "content-type": "application/json" } })).status()).toBe(400);
    const cross = await request.post("/api/errors", {
      data: { source: "web", message: "x" },
      headers: { origin: "https://evil.example" },
    });
    expect(cross.status()).toBe(403);
  });

  test("해결로 표시한 오류가 다시 나면 '처리 전'으로 돌아오고, 무시한 오류는 그대로다", async ({ request }) => {
    await request.post("/api/errors", { data: { source: "app", message: "boom" } });
    await request.post("/api/errors", { data: { source: "web", message: "noise" } });
    const items = (await (await request.get("/api/admin/errors", { headers: admin })).json()).items as { id: number; source: string }[];
    const app = items.find((i) => i.source === "app")!;
    const web = items.find((i) => i.source === "web")!;
    expect((await request.patch(`/api/admin/errors/${app.id}`, { headers: admin, data: { status: "resolved" } })).status()).toBe(200);
    expect((await request.patch(`/api/admin/errors/${web.id}`, { headers: admin, data: { status: "ignored" } })).status()).toBe(200);
    expect((await request.patch(`/api/admin/errors/${web.id}`, { headers: admin, data: { status: "nope" } })).status()).toBe(400);
    expect((await request.patch("/api/admin/errors/99999999", { headers: admin, data: { status: "open" } })).status()).toBe(404);

    await request.post("/api/errors", { data: { source: "app", message: "boom" } });
    await request.post("/api/errors", { data: { source: "web", message: "noise" } });
    const after = (await (await request.get("/api/admin/errors", { headers: admin })).json()).items as { id: number; status: string; count: number; resolvedAt: string | null }[];
    expect(after.find((i) => i.id === app.id)).toMatchObject({ status: "open", count: 2, resolvedAt: null });
    expect(after.find((i) => i.id === web.id)).toMatchObject({ status: "ignored", count: 2 });

    // 필터
    const onlyApp = (await (await request.get("/api/admin/errors?source=app", { headers: admin })).json()).items;
    expect(onlyApp).toHaveLength(1);
  });

  test("서버 오류 기록(onRequestError)은 라우트 모양으로 E-SRV 코드를 남기고, 기록 실패는 던지지 않는다", async () => {
    process.env.DATABASE_URL = process.env.E2E_DATABASE_URL;
    const { onRequestError } = await import("../src/instrumentation");
    process.env.NEXT_RUNTIME = "nodejs";
    await onRequestError(
      new Error("articles 77 broke"),
      { path: "/articles/77?x=1", method: "GET", headers: {} },
      { routerKind: "App Router", routePath: "/articles/[id]", routeType: "render", renderSource: "react-server-components", revalidateReason: undefined },
    );
    const rows = await db.select().from(s.errorEvents).where(eq(s.errorEvents.source, "server"));
    expect(rows).toHaveLength(1);
    expect(rows[0].code).toMatch(/^E-SRV-[0-9A-Z]{5}$/);
    expect(rows[0].path).toBe("/articles/[id]");
    // DB 주소가 잘못돼도 던지지 않는다
    process.env.DATABASE_URL = "postgresql://nobody:x@127.0.0.1:1/none";
    await expect(
      onRequestError(
        new Error("again"),
        { path: "/", method: "GET", headers: {} },
        { routerKind: "App Router", routePath: "/", routeType: "render", renderSource: "react-server-components", revalidateReason: undefined },
      ),
    ).resolves.toBeUndefined();
  });

  test("서로 다른 코드는 500종까지만 새로 만든다(이미 있는 코드는 계속 센다)", async () => {
    const { recordError, MAX_CODES } = await import("../src/lib/errors/store");
    const rows = Array.from({ length: MAX_CODES }, (_, i) => ({
      code: `E-WEB-FILL${i}`,
      source: "web",
      message: `fill ${i}`,
    }));
    await db.insert(s.errorEvents).values(rows);
    const code = await recordError(db, { source: "web", message: "brand new one" });
    expect((await db.select().from(s.errorEvents).where(eq(s.errorEvents.code, code))).length).toBe(0);
    await recordError(db, { source: "web", message: "dummy" }).catch(() => {});
    const again = await db.select().from(s.errorEvents).where(eq(s.errorEvents.code, "E-WEB-FILL0"));
    expect(again[0].count).toBe(1);
  });
});

test.describe("관리자 오류 화면", () => {
  test("오류 코드가 목록에 보이고, 해결됨으로 바꾸면 '처리 전' 목록에서 사라진다", async ({ page, request }) => {
    const { code } = await (await request.post("/api/errors", { data: { source: "web", message: "화면 오류 테스트" } })).json();
    await signInAsAdmin(page);
    await page.goto("/admin/errors");
    const row = page.locator(`[data-error-row="${code}"]`);
    await expect(row).toBeVisible();
    await expect(row).toContainText("화면 오류 테스트");
    await expect(page.locator("[data-open-count]")).toHaveText("1");
    await expect(page.getByText("서버 점검")).toBeVisible();
    await expect(page.getByText("데이터베이스: 정상")).toBeVisible();

    await row.getByRole("button", { name: "해결됨으로" }).click();
    await expect(row).toHaveCount(0);
    await page.getByRole("group", { name: "상태" }).getByRole("button", { name: "해결됨" }).click();
    await expect(page.locator(`[data-error-row="${code}"]`)).toBeVisible();
    await page.locator(`[data-error-row="${code}"]`).getByRole("button", { name: "자세히" }).click();
    await expect(page.getByText("스택 정보가 없어요.")).toBeVisible();

    page.once("dialog", (d) => void d.accept());
    await page.locator(`[data-error-row="${code}"]`).getByRole("button", { name: "지우기" }).click();
    await expect(page.getByText("조건에 맞는 오류가 없어요.")).toBeVisible();
  });
});

test.describe("브라우저에서 난 오류 자동 보고", () => {
  test("화면에서 잡히지 않은 오류가 나면 서버에 보고하고, 같은 오류는 한 번만 보낸다", async ({ page }) => {
    const reports: string[] = [];
    page.on("request", (r) => {
      if (r.url().endsWith("/api/errors") && r.method() === "POST") reports.push(r.postData() ?? "");
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible();
    await page.evaluate(() => {
      for (let i = 0; i < 3; i++) setTimeout(() => { throw new Error("E2E 화면 오류 99"); }, 0);
    });
    await expect.poll(() => reports.length).toBe(1);
    const body = JSON.parse(reports[0]);
    expect(body).toMatchObject({ source: "web", message: "E2E 화면 오류 99", path: "/" });
    await expect.poll(async () => (await db.select().from(s.errorEvents)).length).toBe(1);
  });

  test("잡음(오프라인 네트워크 실패 등)은 보고하지 않는다", async ({ page }) => {
    let n = 0;
    page.on("request", (r) => {
      if (r.url().endsWith("/api/errors")) n++;
    });
    await page.goto("/");
    await page.evaluate(() => {
      setTimeout(() => { throw new Error("Failed to fetch"); }, 0);
      Promise.reject(new Error("ResizeObserver loop completed with undelivered notifications."));
    });
    await page.waitForTimeout(800);
    expect(n).toBe(0);
  });
});
