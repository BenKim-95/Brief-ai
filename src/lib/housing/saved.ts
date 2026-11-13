import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { getDb } from "@/db";
import { housingNotices, savedHousingNotices } from "@/db/schema";

type Db = ReturnType<typeof getDb>;

/** 저장 목록 최대 개수 (페이지네이션 전까지의 안전 상한). */
export const SAVED_NOTICES_LIMIT = 100;

/** Which of `noticeIds` are saved. user_id is null until login (step 8). */
export async function savedNoticeIdSet(db: Db, noticeIds: number[]): Promise<Set<number>> {
  if (noticeIds.length === 0) return new Set();
  const rows = await db
    .select({ noticeId: savedHousingNotices.noticeId })
    .from(savedHousingNotices)
    .where(and(inArray(savedHousingNotices.noticeId, noticeIds), isNull(savedHousingNotices.userId)));
  return new Set(rows.map((r) => r.noticeId));
}

/** Saved notices, most recently saved first. */
export async function listSavedNotices(db: Db) {
  const rows = await db
    .select({ notice: housingNotices })
    .from(savedHousingNotices)
    .innerJoin(housingNotices, eq(savedHousingNotices.noticeId, housingNotices.id))
    .where(isNull(savedHousingNotices.userId))
    .orderBy(desc(savedHousingNotices.savedAt))
    .limit(SAVED_NOTICES_LIMIT);
  return rows.map((r) => r.notice);
}
