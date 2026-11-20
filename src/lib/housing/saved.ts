import { and, desc, eq, inArray } from "drizzle-orm";
import type { getDb } from "@/db";
import { housingNotices, savedHousingNotices } from "@/db/schema";

type Db = ReturnType<typeof getDb>;

/** 저장 목록 최대 개수 (페이지네이션 전까지의 안전 상한). */
export const SAVED_NOTICES_LIMIT = 100;

/** `noticeIds` 중 이 방문자가 저장한 것. 방문자 번호가 없으면 빈 집합. */
export async function savedNoticeIdSet(
  db: Db,
  noticeIds: number[],
  visitorId: string | null,
): Promise<Set<number>> {
  if (noticeIds.length === 0 || !visitorId) return new Set();
  const rows = await db
    .select({ noticeId: savedHousingNotices.noticeId })
    .from(savedHousingNotices)
    .where(and(inArray(savedHousingNotices.noticeId, noticeIds), eq(savedHousingNotices.userId, visitorId)));
  return new Set(rows.map((r) => r.noticeId));
}

/** 이 방문자가 저장한 공고, 최근에 저장한 순. */
export async function listSavedNotices(db: Db, visitorId: string | null) {
  if (!visitorId) return [];
  const rows = await db
    .select({ notice: housingNotices })
    .from(savedHousingNotices)
    .innerJoin(housingNotices, eq(savedHousingNotices.noticeId, housingNotices.id))
    .where(eq(savedHousingNotices.userId, visitorId))
    .orderBy(desc(savedHousingNotices.savedAt))
    .limit(SAVED_NOTICES_LIMIT);
  return rows.map((r) => r.notice);
}
