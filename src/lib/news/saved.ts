import { and, desc, eq, inArray } from "drizzle-orm";
import type { getDb } from "@/db";
import { articles, categories, savedArticles, sources } from "@/db/schema";
import type { ArticleCard } from "./queries";

type Db = ReturnType<typeof getDb>;

/** 저장 목록 최대 개수 (페이지네이션 전까지의 안전 상한). */
export const SAVED_LIMIT = 100;

/** `articleIds` 중 이 방문자가 저장한 것. 방문자 번호가 없으면(쿠키 없음) 빈 집합. */
export async function savedIdSet(
  db: Db,
  articleIds: number[],
  visitorId: string | null,
): Promise<Set<number>> {
  if (articleIds.length === 0 || !visitorId) return new Set();
  const rows = await db
    .select({ articleId: savedArticles.articleId })
    .from(savedArticles)
    .where(and(inArray(savedArticles.articleId, articleIds), eq(savedArticles.userId, visitorId)));
  return new Set(rows.map((r) => r.articleId));
}

/** 이 방문자가 저장한 기사, 최근에 저장한 순. */
export async function listSaved(db: Db, visitorId: string | null): Promise<ArticleCard[]> {
  if (!visitorId) return [];
  return db
    .select({
      id: articles.id,
      url: articles.url,
      titleKo: articles.titleKo,
      summaryKo: articles.summaryKo,
      imageUrl: articles.imageUrl,
      categoryId: articles.categoryId,
      categoryName: categories.name,
      sourceName: sources.name,
      publishedAt: articles.publishedAt,
      fetchedAt: articles.fetchedAt,
    })
    .from(savedArticles)
    .innerJoin(articles, eq(savedArticles.articleId, articles.id))
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(sources, eq(articles.sourceId, sources.id))
    .where(eq(savedArticles.userId, visitorId))
    .orderBy(desc(savedArticles.savedAt))
    .limit(SAVED_LIMIT);
}
