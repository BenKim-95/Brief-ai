import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import type { getDb } from "@/db";
import { articles, savedArticles } from "@/db/schema";
import { getProfile } from "@/lib/my/profile";

type Db = ReturnType<typeof getDb>;

/** 저장한 소식에서 읽어 오는 카테고리 개수(많이 저장한 순). */
export const SAVED_INTEREST_LIMIT = 3;

export type Interests = {
  /** 마이페이지에서 직접 고른 카테고리 */
  chosen: number[];
  /** 저장한 소식이 많이 속한 카테고리(직접 고른 것과 겹치면 뺀다) */
  fromSaved: number[];
  /** 둘을 합친 전체 */
  all: number[];
};

/** "나와 관련된" 카테고리를 정한다: 직접 고른 관심 카테고리 + 자주 저장한 소식의 카테고리. */
export function mergeInterests(chosen: number[], savedCategoryIds: number[]): Interests {
  const uniqChosen = [...new Set(chosen)];
  const fromSaved = [...new Set(savedCategoryIds)].filter((id) => !uniqChosen.includes(id));
  return { chosen: uniqChosen, fromSaved, all: [...uniqChosen, ...fromSaved] };
}

export async function getInterests(db: Db, visitorId: string | null): Promise<Interests> {
  if (!visitorId) return { chosen: [], fromSaved: [], all: [] };
  const profile = await getProfile(db, visitorId);
  const rows = await db
    .select({ categoryId: articles.categoryId, n: sql<number>`count(*)::int` })
    .from(savedArticles)
    .innerJoin(articles, eq(savedArticles.articleId, articles.id))
    .where(and(eq(savedArticles.userId, visitorId), isNotNull(articles.categoryId)))
    .groupBy(articles.categoryId)
    .orderBy(desc(sql`count(*)`))
    .limit(SAVED_INTEREST_LIMIT);
  return mergeInterests(
    profile.interestCategoryIds,
    rows.map((r) => r.categoryId).filter((id): id is number => id !== null),
  );
}
