import { asc, eq, inArray, sql } from "drizzle-orm";
import type { getDb } from "@/db";
import { housingCategories, housingFeeds, housingNotices } from "@/db/schema";
import { fetchApplyhomeFeed, type NoticeInput } from "./applyhome";
import { classifyNotice } from "./classify";
import { fillHousingImages } from "./image";
import { todayKst } from "./status";

type Db = ReturnType<typeof getDb>;

/** Only notices announced within this window are requested from the API. */
export const LOOKBACK_DAYS = 180;
const UPSERT_CHUNK = 100;

export function sinceDate(today: string, days = LOOKBACK_DAYS): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Re-applies the keyword rules to every stored notice. No API/AI calls. */
export async function reclassifyHousingNotices(db: Db): Promise<number> {
  const cats = await db
    .select({ id: housingCategories.id, keywords: housingCategories.keywords })
    .from(housingCategories)
    .orderBy(asc(housingCategories.sortOrder), asc(housingCategories.id));
  const rows = await db
    .select({
      id: housingNotices.id,
      typeLabel: housingNotices.typeLabel,
      categoryId: housingNotices.categoryId,
      feedName: housingFeeds.name,
    })
    .from(housingNotices)
    .leftJoin(housingFeeds, eq(housingNotices.feedId, housingFeeds.id));

  const changes = new Map<number | null, number[]>();
  for (const r of rows) {
    const next = classifyNotice(cats, r.feedName, r.typeLabel);
    if (next === r.categoryId) continue;
    const ids = changes.get(next) ?? [];
    ids.push(r.id);
    changes.set(next, ids);
  }
  let changed = 0;
  for (const [categoryId, ids] of changes) {
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      await db
        .update(housingNotices)
        .set({ categoryId })
        .where(inArray(housingNotices.id, chunk));
      changed += chunk.length;
    }
  }
  return changed;
}

export type FeedResult = {
  feedId: number;
  name: string;
  ok: boolean;
  received: number;
  inserted: number;
  /** 이미 저장돼 있고 일정이 바뀌어 고친 공고 수 */
  updated: number;
  /** 이미 저장돼 있고 일정이 그대로라 건너뛴 공고 수 */
  unchanged: number;
  skipped: number;
  error?: string;
};

/**
 * 공고 저장: 새 공고는 넣고, 이미 있는 공고(공고 번호가 같은 것)는 **일정이 바뀐 경우에만** 고친다.
 * - 일정 = 모집공고일, 접수 시작일, 접수 종료일, 당첨자 발표일. 이 중 하나라도 값이 달라졌을 때만 갱신한다.
 * - 이름·공급 규모·주소 등 다른 항목이 달라진 것만으로는 건드리지 않는다(DB 쓰기 없음).
 * - API 가 일정을 비워서 보내면(null) 저장된 값을 지우지 않고 그대로 둔다.
 */
export async function saveNotices(db: Db, feedId: number, notices: NoticeInput[]) {
  // 같은 공고가 여러 쪽에 걸쳐 두 번 올 수 있어 공고 번호로 먼저 합친다.
  const unique = [...new Map(notices.map((n) => [n.externalId, n])).values()];
  const changed = (col: string, cur: unknown) =>
    sql`(excluded.${sql.raw(col)} is not null and excluded.${sql.raw(col)} is distinct from ${cur})`;
  let inserted = 0;
  let updated = 0;
  for (let i = 0; i < unique.length; i += UPSERT_CHUNK) {
    const chunk = unique.slice(i, i + UPSERT_CHUNK);
    const res = await db
      .insert(housingNotices)
      .values(chunk.map((n) => ({ ...n, feedId })))
      .onConflictDoUpdate({
        target: housingNotices.externalId,
        set: {
          announcedOn: sql`coalesce(excluded.announced_on, ${housingNotices.announcedOn})`,
          receiptStart: sql`coalesce(excluded.receipt_start, ${housingNotices.receiptStart})`,
          receiptEnd: sql`coalesce(excluded.receipt_end, ${housingNotices.receiptEnd})`,
          winnerOn: sql`coalesce(excluded.winner_on, ${housingNotices.winnerOn})`,
          raw: sql`excluded.raw`,
          updatedAt: sql`now()`,
        },
        // 일정이 하나라도 달라진 공고만 갱신한다. 아니면 이 줄은 건너뛰고 반환되지도 않는다.
        setWhere: sql`${changed("announced_on", housingNotices.announcedOn)} or ${changed("receipt_start", housingNotices.receiptStart)} or ${changed("receipt_end", housingNotices.receiptEnd)} or ${changed("winner_on", housingNotices.winnerOn)}`,
      })
      .returning({ inserted: sql<boolean>`(xmax = 0)` });
    inserted += res.filter((r) => r.inserted).length;
    updated += res.filter((r) => !r.inserted).length;
  }
  return { inserted, updated, unchanged: unique.length - inserted - updated };
}

/** Pulls every active feed, saves new notices (and schedule changes of stored ones), then classifies. */
export async function syncHousing(db: Db, serviceKey: string) {
  const feeds = await db
    .select()
    .from(housingFeeds)
    .where(eq(housingFeeds.active, true))
    .orderBy(asc(housingFeeds.id));
  const since = sinceDate(todayKst());

  const results: FeedResult[] = [];
  for (const feed of feeds) {
    const base = { feedId: feed.id, name: feed.name };
    try {
      const { notices, skipped } = await fetchApplyhomeFeed(
        feed.endpoint,
        serviceKey,
        since,
      );
      const { inserted, updated, unchanged } = await saveNotices(db, feed.id, notices);
      results.push({ ...base, ok: true, received: notices.length, inserted, updated, unchanged, skipped });
    } catch (e) {
      results.push({
        ...base,
        ok: false,
        received: 0,
        inserted: 0,
        updated: 0,
        unchanged: 0,
        skipped: 0,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  await reclassifyHousingNotices(db);
  const images = await fillHousingImages(db).catch((e) => ({
    checked: 0,
    filled: 0,
    error: e instanceof Error ? e.message : String(e),
  }));
  return { since, results, images };
}

