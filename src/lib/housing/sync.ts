import { asc, eq, inArray, sql } from "drizzle-orm";
import type { getDb } from "@/db";
import { housingCategories, housingFeeds, housingNotices } from "@/db/schema";
import { fetchApplyhomeFeed, type NoticeInput } from "./applyhome";
import { classifyNotice } from "./classify";
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
  updated: number;
  skipped: number;
  error?: string;
};

async function upsertNotices(db: Db, feedId: number, notices: NoticeInput[]) {
  // The same notice can appear twice across pages; ON CONFLICT can't touch a
  // row twice in one statement.
  const unique = [...new Map(notices.map((n) => [n.externalId, n])).values()];
  let inserted = 0;
  for (let i = 0; i < unique.length; i += UPSERT_CHUNK) {
    const chunk = unique.slice(i, i + UPSERT_CHUNK);
    const res = await db
      .insert(housingNotices)
      .values(chunk.map((n) => ({ ...n, feedId })))
      .onConflictDoUpdate({
        target: housingNotices.externalId,
        set: {
          feedId: sql`excluded.feed_id`,
          name: sql`excluded.name`,
          typeLabel: sql`excluded.type_label`,
          region: sql`excluded.region`,
          address: sql`excluded.address`,
          supplyCount: sql`excluded.supply_count`,
          announcedOn: sql`excluded.announced_on`,
          receiptStart: sql`excluded.receipt_start`,
          receiptEnd: sql`excluded.receipt_end`,
          winnerOn: sql`excluded.winner_on`,
          detailUrl: sql`excluded.detail_url`,
          raw: sql`excluded.raw`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ inserted: sql<boolean>`(xmax = 0)` });
    inserted += res.filter((r) => r.inserted).length;
  }
  return { inserted, updated: unique.length - inserted };
}

/** Pulls every active feed, upserts notices, then reclassifies. */
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
      const { inserted, updated } = await upsertNotices(db, feed.id, notices);
      results.push({ ...base, ok: true, received: notices.length, inserted, updated, skipped });
    } catch (e) {
      results.push({
        ...base,
        ok: false,
        received: 0,
        inserted: 0,
        updated: 0,
        skipped: 0,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  await reclassifyHousingNotices(db);
  return { since, results };
}

