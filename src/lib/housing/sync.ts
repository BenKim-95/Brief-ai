import { asc, eq, inArray } from "drizzle-orm";
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
  /** 이미 저장돼 있어 건너뛴 공고 수 */
  existing: number;
  skipped: number;
  error?: string;
};

/**
 * 새 공고만 저장한다. 이미 저장된 공고(공고 번호가 같은 것)는 건드리지 않고 건너뛴다
 * → 매일 같은 공고가 다시 들어와도 DB 쓰기·갱신이 없다. (공고 일정이 바뀌어도 반영하지 않는다.)
 */
export async function insertNewNotices(db: Db, feedId: number, notices: NoticeInput[]) {
  // 같은 공고가 여러 쪽에 걸쳐 두 번 올 수 있어 공고 번호로 먼저 합친다.
  const unique = [...new Map(notices.map((n) => [n.externalId, n])).values()];
  let inserted = 0;
  for (let i = 0; i < unique.length; i += UPSERT_CHUNK) {
    const chunk = unique.slice(i, i + UPSERT_CHUNK);
    const res = await db
      .insert(housingNotices)
      .values(chunk.map((n) => ({ ...n, feedId })))
      .onConflictDoNothing({ target: housingNotices.externalId })
      .returning({ id: housingNotices.id });
    inserted += res.length;
  }
  return { inserted, existing: unique.length - inserted };
}

/** Pulls every active feed, saves only the new notices, then classifies. */
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
      const { inserted, existing } = await insertNewNotices(db, feed.id, notices);
      results.push({ ...base, ok: true, received: notices.length, inserted, existing, skipped });
    } catch (e) {
      results.push({
        ...base,
        ok: false,
        received: 0,
        inserted: 0,
        existing: 0,
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

