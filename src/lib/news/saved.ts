import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { getDb } from "@/db";
import { articles, categories, savedArticles, sources } from "@/db/schema";
import type { ArticleCard } from "./queries";

type Db = ReturnType<typeof getDb>;

/** 저장 목록 최대 개수 (페이지네이션 전까지의 안전 상한). */
export const SAVED_LIMIT = 100;

/** Which of `articleIds` are saved. user_id is null until login (step 8). */
export async function savedIdSet(db: Db, articleIds: number[]): Promise<Set<number>> {
  if (articleIds.length === 0) return new Set();
  const rows = await db
    .select({ articleId: savedArticles.articleId })
    .from(savedArticles)
    .where(and(inArray(savedArticles.articleId, articleIds), isNull(savedArticles.userId)));
  return new Set(rows.map((r) => r.articleId));
}

/** Saved articles, most recently saved first. */
export async function listSaved(db: Db): Promise<ArticleCard[]> {
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
    .where(isNull(savedArticles.userId))
    .orderBy(desc(savedArticles.savedAt))
    .limit(SAVED_LIMIT);
}
