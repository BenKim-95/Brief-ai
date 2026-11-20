import type Anthropic from "@anthropic-ai/sdk";
import { desc, eq, isNull, sql } from "drizzle-orm";
import type { getDb } from "@/db";
import { articles } from "@/db/schema";
import { generateInsights } from "./enrich";

type Db = ReturnType<typeof getDb>;

/** 요청 한 번에 채우는 최대 기사 수(비용 상한). 남은 건 버튼이 이어서 다시 요청한다. */
export const BACKFILL_LIMIT = 40;
/** Claude에 한 번에 보내는 기사 수 (뉴스 가져오기와 같은 크기). */
const BATCH = 5;
/** 동시에 보내는 묶음 수. */
const CONCURRENCY = 3;
/**
 * 새 묶음을 시작해도 되는 시간 한도(밀리초). 서버 함수 제한(60초)을 넘기면 504가 나므로,
 * 한 묶음이 더 걸려도 끝낼 수 있도록 여유를 두고 일찍 멈춘다. 멈춘 뒤 남은 기사는 다음 요청이 이어서 채운다.
 */
export const BACKFILL_BUDGET_MS = 30_000;

export type BackfillResult = { filled: number; remaining: number; failedBatches: string[] };

/**
 * AI 해설이 아직 없는 기존 기사에 한 줄 요약·알게 된 점·다른 시각을 채운다(최신 기사부터).
 * 제목과 이미 저장된 한국어 요약만 쓰고, 한 묶음이 실패해도 나머지는 계속한다.
 * 묶음을 동시에 처리하며, 시간 예산을 넘기면 새 묶음을 시작하지 않고 끝낸다(최소 한 번은 처리).
 * `remaining`은 끝난 뒤에도 해설이 없는 기사 수 전체다.
 */
export async function backfillInsights(
  db: Db,
  client: Anthropic,
  opts: { limit?: number; budgetMs?: number; concurrency?: number } = {},
): Promise<BackfillResult> {
  const limit = opts.limit ?? BACKFILL_LIMIT;
  const budgetMs = opts.budgetMs ?? BACKFILL_BUDGET_MS;
  const concurrency = Math.max(1, opts.concurrency ?? CONCURRENCY);
  const startedAt = Date.now();

  const todo = await db
    .select({ id: articles.id, titleKo: articles.titleKo, summaryKo: articles.summaryKo })
    .from(articles)
    .where(isNull(articles.insightOneLine))
    .orderBy(desc(articles.id))
    .limit(limit);

  const batches: (typeof todo)[] = [];
  for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH));

  const result: BackfillResult = { filled: 0, remaining: 0, failedBatches: [] };

  async function runBatch(chunk: typeof todo, number: number) {
    try {
      const got = await generateInsights(
        client,
        chunk.map((a, key) => ({ key, titleKo: a.titleKo, summaryKo: a.summaryKo })),
      );
      await Promise.all(
        [...got].map(([key, ins]) =>
          db
            .update(articles)
            .set({
              insightOneLine: ins.oneLineKo,
              insightLearned: ins.learnedKo,
              insightPerspective: ins.perspectiveKo,
            })
            .where(eq(articles.id, chunk[key].id))
            .then(() => {
              result.filled++;
            }),
        ),
      );
    } catch (e) {
      result.failedBatches.push(`${number}번째 묶음: ${e instanceof Error ? e.message : "처리 실패"}`);
    }
  }

  for (let i = 0; i < batches.length; i += concurrency) {
    if (i > 0 && Date.now() - startedAt > budgetMs) break;
    await Promise.all(batches.slice(i, i + concurrency).map((chunk, j) => runBatch(chunk, i + j + 1)));
  }

  const [left] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(articles)
    .where(isNull(articles.insightOneLine));
  result.remaining = left?.n ?? 0;
  return result;
}
