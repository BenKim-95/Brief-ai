import { and, asc, desc, eq, isNull, or, gte, sql, type SQL } from "drizzle-orm";
import type { getDb } from "@/db";
import { housingCategories, housingNotices } from "@/db/schema";

type Db = ReturnType<typeof getDb>;

/** `category`: a category id, "none" for 미분류, or undefined for all. */
export type NoticeFilter = {
  category?: number | "none";
  region?: string;
  includeClosed: boolean;
  today: string;
};

export const NOTICES_PER_PAGE = 6;

export async function listHousingCategories(db: Db) {
  return db
    .select({ id: housingCategories.id, name: housingCategories.name })
    .from(housingCategories)
    .orderBy(asc(housingCategories.sortOrder), asc(housingCategories.id));
}

export async function listRegions(db: Db) {
  const rows = await db
    .selectDistinct({ region: housingNotices.region })
    .from(housingNotices)
    .orderBy(asc(housingNotices.region));
  return rows.map((r) => r.region).filter((r): r is string => !!r);
}

function noticeWhere(f: NoticeFilter) {
  const lastDay = sql`coalesce(${housingNotices.receiptEnd}, ${housingNotices.receiptStart})`;
  const conds: SQL[] = [];
  if (f.category === "none") conds.push(isNull(housingNotices.categoryId));
  else if (f.category !== undefined) conds.push(eq(housingNotices.categoryId, f.category));
  if (f.region) conds.push(eq(housingNotices.region, f.region));
  if (!f.includeClosed) {
    conds.push(or(sql`${lastDay} is null`, gte(lastDay, f.today))!);
  }
  return { lastDay, where: conds.length ? and(...conds) : undefined };
}

export async function countHousingNotices(db: Db, f: NoticeFilter) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(housingNotices)
    .where(noticeWhere(f).where);
  return row?.n ?? 0;
}

/** Open/upcoming first by receipt start (soonest first), then closed (latest first). */
export async function listHousingNotices(db: Db, f: NoticeFilter, page: number) {
  const { lastDay, where } = noticeWhere(f);
  const closed = sql`case when ${lastDay} < ${f.today} then 1 else 0 end`;
  return db
    .select()
    .from(housingNotices)
    .where(where)
    .orderBy(
      asc(closed),
      sql`case when ${lastDay} >= ${f.today} or ${lastDay} is null then ${housingNotices.receiptStart} end asc nulls last`,
      desc(housingNotices.receiptStart),
      desc(housingNotices.id),
    )
    .limit(NOTICES_PER_PAGE)
    .offset((page - 1) * NOTICES_PER_PAGE);
}
