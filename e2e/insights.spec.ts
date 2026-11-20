import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import { eq, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import * as s from "../src/db/schema";
import { backfillInsights } from "../src/lib/news/insights";
import { E2E_PREFIX } from "./global-setup";
import { ADMIN_TOKEN } from "./helpers";

const db = drizzle(neon(process.env.E2E_DATABASE_URL!), { schema: s });
const card = (page: import("@playwright/test").Page, title: string) =>
  page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: title }) });

test.describe("AI 해설 3줄", () => {
  test("해설이 있는 카드에는 3줄이 보이고, 없는 카드에는 아무것도 보이지 않는다", async ({ page }) => {
    await page.goto("/");
    const withInsight = card(page, `${E2E_PREFIX} 모델 소식 1`).getByRole("region", { name: "AI 해설" });
    await expect(withInsight).toBeVisible();
    await expect(withInsight).toContainText("한 줄 요약");
    await expect(withInsight).toContainText("한 줄 요약 테스트예요.");
    await expect(withInsight).toContainText("알게 된 점");
    await expect(withInsight).toContainText("다른 시각");
    await expect(withInsight).toContainText("Claude AI");
    await expect(card(page, `${E2E_PREFIX} 모델 소식 2`).getByRole("region", { name: "AI 해설" })).toHaveCount(0);
  });

  test("채우기 API는 토큰이 없으면 401, 키가 없으면 503", async ({ request }) => {
    expect((await request.post("/api/news/insights")).status()).toBe(401);
    expect((await request.post("/api/news/insights", { headers: { "x-admin-token": ADMIN_TOKEN } })).status()).toBe(503);
  });

  test("해설이 없는 기존 기사만 채우고, 이미 있는 해설은 건드리지 않는다", async () => {
    test.setTimeout(60_000);
    const asked: string[] = [];
    const client = {
      messages: {
        create: async (args: { messages: { content: string }[] }) => {
          const rows = [...args.messages[0].content.matchAll(/\[key (\d+)\]\n제목: ([^\n]*)/g)];
          for (const m of rows) asked.push(m[2]);
          const out = rows.map((m) => ({
            key: Number(m[1]),
            oneLineKo: `한줄 ${m[2]}`,
            learnedKo: `점 ${m[2]}`,
            perspectiveKo: `시각 ${m[2]}`,
          }));
          return { content: [{ type: "text", text: JSON.stringify(out) }], stop_reason: "end_turn" };
        },
      },
    } as never;

    const before = await db.select().from(s.articles).where(like(s.articles.titleKo, `${E2E_PREFIX}%`));
    const had = before.filter((a) => a.insightOneLine !== null);
    const missing = before.filter((a) => a.insightOneLine === null);
    expect(had).toHaveLength(1);

    try {
      const r = await backfillInsights(db, client);
      expect(r).toEqual({ filled: missing.length, remaining: 0, failedBatches: [] });
      // 이미 해설이 있는 기사는 Claude에 보내지도, 덮어쓰지도 않았다.
      expect(asked).not.toContain(had[0].titleKo);
      const [kept] = await db.select().from(s.articles).where(eq(s.articles.id, had[0].id));
      expect(kept.insightOneLine).toBe("한 줄 요약 테스트예요.");
      const [filled] = await db.select().from(s.articles).where(eq(s.articles.id, missing[0].id));
      expect(filled.insightOneLine).toBe(`한줄 ${missing[0].titleKo}`);
      // 다 채웠으니 한 번 더 해도 보낼 기사가 없다.
      asked.length = 0;
      expect(await backfillInsights(db, client)).toEqual({ filled: 0, remaining: 0, failedBatches: [] });
      expect(asked).toHaveLength(0);
    } finally {
      // 다른 테스트가 "해설 없는 카드"를 기대하므로 원래대로 되돌린다.
      for (const a of missing) {
        await db
          .update(s.articles)
          .set({ insightOneLine: null, insightLearned: null, insightPerspective: null })
          .where(eq(s.articles.id, a.id));
      }
    }
  });
});
