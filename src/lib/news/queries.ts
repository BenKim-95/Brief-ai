import { asc, desc, eq, exists, inArray, sql } from "drizzle-orm";
import type { getDb } from "@/db";
import { articles, categories, sources } from "@/db/schema";

type Db = ReturnType<typeof getDb>;

export type ArticleCard = {
  id: number;
  url: string;
  titleKo: string;
  summaryKo: string;
  imageUrl: string | null;
  categoryId: number | null;
  categoryName: string | null;
  sourceName: string | null;
  publishedAt: Date | null;
  fetchedAt: Date;
};

export const ARTICLES_PER_PAGE = 6;

/** 카테고리 하나(categoryId) 또는 여러 개(categoryIds)로 거른다. 빈 배열이면 아무 기사도 걸리지 않는다. */
function categoryFilter(opts: { categoryId?: number; categoryIds?: number[] }) {
  if (opts.categoryIds) {
    return opts.categoryIds.length ? inArray(articles.categoryId, opts.categoryIds) : sql`false`;
  }
  return opts.categoryId ? eq(articles.categoryId, opts.categoryId) : undefined;
}

/** Total stored articles, plus how many are newer than `since` (for the headline). */
export async function countArticles(
  db: Db,
  opts: { categoryId?: number; categoryIds?: number[]; since: Date },
) {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      fresh: sql<number>`(count(*) filter (where coalesce(${articles.publishedAt}, ${articles.fetchedAt}) >= ${opts.since.toISOString()}::timestamptz))::int`,
    })
    .from(articles)
    .where(categoryFilter(opts));
  return { total: row?.total ?? 0, fresh: row?.fresh ?? 0 };
}

export async function listArticles(
  db: Db,
  opts: { categoryId?: number; categoryIds?: number[]; page?: number } = {},
): Promise<ArticleCard[]> {
  const page = opts.page ?? 1;
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
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(sources, eq(articles.sourceId, sources.id))
    .where(categoryFilter(opts))
    .orderBy(desc(sql`coalesce(${articles.publishedAt}, ${articles.fetchedAt})`))
    .limit(ARTICLES_PER_PAGE)
    .offset((page - 1) * ARTICLES_PER_PAGE);
}

/**
 * 카테고리 목록(정렬 순서대로).
 * `onlyWithArticles`: 기사가 한 건도 없는 카테고리(예: 아직 기사가 안 들어오는 "메인"·"추천")는 뺀다.
 * 기사가 들어오면 저절로 다시 나타난다.
 */
export async function listCategories(db: Db, opts: { onlyWithArticles?: boolean } = {}) {
  return db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(
      opts.onlyWithArticles
        ? exists(db.select({ one: sql`1` }).from(articles).where(eq(articles.categoryId, categories.id)))
        : undefined,
    )
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

const cardColumns = {
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
};

/** 기사 한 건(위젯·알림에서 바로 여는 화면용). 없으면 null. */
export async function getArticleCard(db: Db, id: number): Promise<ArticleCard | null> {
  const [row] = await db
    .select(cardColumns)
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(sources, eq(articles.sourceId, sources.id))
    .where(eq(articles.id, id))
    .limit(1);
  return row ?? null;
}

/** 최신순으로 `limit`개(위젯용). 홈 목록과 같은 정렬 기준이다. */
export async function listLatest(db: Db, limit: number): Promise<ArticleCard[]> {
  return db
    .select(cardColumns)
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(sources, eq(articles.sourceId, sources.id))
    .orderBy(desc(sql`coalesce(${articles.publishedAt}, ${articles.fetchedAt})`))
    .limit(limit);
}
