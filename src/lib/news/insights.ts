import type Anthropic from "@anthropic-ai/sdk";
import { desc, eq, isNull } from "drizzle-orm";
import type { getDb } from "@/db";
import { articles } from "@/db/schema";
import { generateInsights } from "./enrich";

type Db = ReturnType<typeof getDb>;

/** 한 번 누를 때 채우는 최대 기사 수(시간·비용 상한). 남은 건 한 번 더 누르면 이어서 채운다. */
export const BACKFILL_LIMIT = 40;
/** Claude에 한 번에 보내는 기사 수 (뉴스 가져오기와 같은 크기). */
const BATCH = 5;

export type BackfillResult = { filled: number; remaining: number; failedBatches: string[] };

/**
 * AI 해설이 아직 없는 기존 기사에 한 줄 요약·알게 된 점·다른 시각을 채운다(최신 기사부터).
 * 제목과 이미 저장된 한국어 요약만 쓰고, 한 묶음이 실패해도 나머지는 계속한다.
 */
export async function backfillInsights(
  db: Db,
  client: Anthropic,
  opts: { limit?: number } = {},
): Promise<BackfillResult> {
  const limit = opts.limit ?? BACKFILL_LIMIT;
  const todo = await db
    .select({ id: articles.id, titleKo: articles.titleKo, summaryKo: articles.summaryKo })
    .from(articles)
    .where(isNull(articles.insightOneLine))
    .orderBy(desc(articles.id))
    .limit(limit + 1);
  const batch = todo.slice(0, limit);
  const result: BackfillResult = { filled: 0, remaining: Math.max(0, todo.length - limit), failedBatches: [] };

  for (let i = 0; i < batch.length; i += BATCH) {
    const chunk = batch.slice(i, i + BATCH);
    try {
      const got = await generateInsights(
        client,
        chunk.map((a, key) => ({ key, titleKo: a.titleKo, summaryKo: a.summaryKo })),
      );
      for (const [key, ins] of got) {
        await db
          .update(articles)
          .set({
            insightOneLine: ins.oneLineKo,
            insightLearned: ins.learnedKo,
            insightPerspective: ins.perspectiveKo,
          })
          .where(eq(articles.id, chunk[key].id));
        result.filled++;
      }
    } catch (e) {
      result.failedBatches.push(`${i / BATCH + 1}번째 묶음: ${e instanceof Error ? e.message : "처리 실패"}`);
    }
  }
  // 이번에 못 채운 기사까지 합쳐 "아직 남은 수"를 맞춘다.
  result.remaining += batch.length - result.filled;
  return result;
}
