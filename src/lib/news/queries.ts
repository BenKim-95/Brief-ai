import { asc, desc, eq, sql } from "drizzle-orm";
import type { getDb } from "@/db";
import { articles, categories, sources } from "@/db/schema";

type Db = ReturnType<typeof getDb>;

export type ArticleCard = {
  id: number;
  url: string;
  titleKo: string;
  summaryKo: string;
  categoryId: number | null;
  categoryName: string | null;
  sourceName: string | null;
  publishedAt: Date | null;
  fetchedAt: Date;
};

export async function listArticles(
  db: Db,
  opts: { categoryId?: number; limit?: number } = {},
): Promise<ArticleCard[]> {
  return db
    .select({
      id: articles.id,
      url: articles.url,
      titleKo: articles.titleKo,
      summaryKo: articles.summaryKo,
      categoryId: articles.categoryId,
      categoryName: categories.name,
      sourceName: sources.name,
      publishedAt: articles.publishedAt,
      fetchedAt: articles.fetchedAt,
    })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(sources, eq(articles.sourceId, sources.id))
    .where(opts.categoryId ? eq(articles.categoryId, opts.categoryId) : undefined)
    .orderBy(desc(sql`coalesce(${articles.publishedAt}, ${articles.fetchedAt})`))
    .limit(opts.limit ?? 30);
}

export async function listCategories(db: Db) {
  return db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .orderBy(asc(categories.sortOrder));
}

/** "방금", "3시간 전", "어제", "5월 3일". */
export function timeAgo(d: Date, now = new Date()): string {
  const min = Math.floor((now.getTime() - d.getTime()) / 60_000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  const days = Math.floor(h / 24);
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  const kst = new Date(d.getTime() + 9 * 3_600_000);
  return `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`;
}
