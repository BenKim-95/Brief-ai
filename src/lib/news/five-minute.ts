import { desc, eq, gte, sql } from "drizzle-orm";
import type { getDb } from "@/db";
import { articleViews, articles, categories, sources } from "@/db/schema";
import { cardColumns, type ArticleCard } from "./queries";

type Db = ReturnType<typeof getDb>;

/** 5분 이슈에 담는 기사 수(= 분야 수). */
export const FIVE_MINUTE_COUNT = 5;
/** 이 시간 안에 나온 기사만 후보로 삼는다. 소식이 뜸한 날에도 5개가 채워지도록 하루보다 조금 넉넉하게. */
export const CANDIDATE_HOURS = 48;

export type Candidate = {
  id: number;
  categoryId: number | null;
  /** 나온 시각(밀리초). 같은 조회수일 때 최신을 먼저 고르는 데 쓴다. */
  at: number;
  views: number;
};

/** 조회수가 많은 순, 같으면 최신, 그래도 같으면 번호가 큰 쪽(= 나중에 저장된 쪽). */
function better(a: Candidate, b: Candidate) {
  return b.views - a.views || b.at - a.at || b.id - a.id;
}

/**
 * 분야(카테고리)마다 가장 많이 본 기사 1개씩을 골라, 그 조회수가 높은 분야부터 `total`개를 돌려준다.
 * 분야가 `total`개보다 적으면 남은 기사 중 많이 본 순으로 채운다(분류가 안 된 기사도 이때만 쓴다).
 * 순수 함수라서 DB 없이 테스트할 수 있다.
 */
export function pickFiveMinute(candidates: Candidate[], total = FIVE_MINUTE_COUNT): Candidate[] {
  const bestByCategory = new Map<number, Candidate>();
  for (const c of candidates) {
    if (c.categoryId === null) continue;
    const cur = bestByCategory.get(c.categoryId);
    if (!cur || better(c, cur) < 0) bestByCategory.set(c.categoryId, c);
  }
  const picked = [...bestByCategory.values()].sort(better).slice(0, total);
  if (picked.length >= total) return picked;
  const used = new Set(picked.map((p) => p.id));
  const rest = candidates.filter((c) => !used.has(c.id)).sort(better);
  return [...picked, ...rest.slice(0, total - picked.length)];
}

/** 한국 시간 기준 오늘 날짜(YYYY-MM-DD). 조회수는 이 날짜 단위로 센다. */
export function kstDay(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
}

export type FiveMinuteItem = { article: ArticleCard; views: number };

/** 오늘(한국 시간) 가장 많이 본 소식을 분야별 1개씩 모아 5개를 돌려준다. */
export async function getFiveMinuteIssues(db: Db, now = new Date()): Promise<FiveMinuteItem[]> {
  const since = new Date(now.getTime() - CANDIDATE_HOURS * 3_600_000);
  const today = kstDay(now);
  const at = sql<Date>`coalesce(${articles.publishedAt}, ${articles.fetchedAt})`;

  const rows = await db
    .select({
      ...cardColumns,
      views: sql<number>`coalesce((select count(*) from ${articleViews} v where v.article_id = ${articles.id} and v.day = ${today}), 0)::int`,
    })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(sources, eq(articles.sourceId, sources.id))
    .where(gte(at, since))
    .orderBy(desc(at))
    .limit(500);

  const byId = new Map(rows.map((r) => [r.id, r]));
  const picked = pickFiveMinute(
    rows.map((r) => ({
      id: r.id,
      categoryId: r.categoryId,
      at: (r.publishedAt ?? r.fetchedAt).getTime(),
      views: r.views,
    })),
  );
  return picked.map((p) => {
    const { views, ...article } = byId.get(p.id)!;
    return { article, views };
  });
}

/** 이 방문자의 오늘 조회를 기록한다(같은 방문자가 같은 기사를 여러 번 열어도 하루 1회). 새로 기록됐으면 true. */
export async function recordView(db: Db, articleId: number, visitorId: string, now = new Date()): Promise<boolean> {
  const rows = await db
    .insert(articleViews)
    .values({ articleId, visitorId, day: kstDay(now) })
    .onConflictDoNothing()
    .returning({ articleId: articleViews.articleId });
  return rows.length > 0;
}

/** 오래된 조회 기록을 지운다(5분 이슈는 오늘 기록만 쓴다). 기본 30일 보관. */
export async function pruneViews(db: Db, keepDays = 30, now = new Date()): Promise<number> {
  const cutoff = kstDay(new Date(now.getTime() - keepDays * 86_400_000));
  const gone = await db.delete(articleViews).where(sql`${articleViews.day} < ${cutoff}`).returning({ a: articleViews.articleId });
  return gone.length;
}
