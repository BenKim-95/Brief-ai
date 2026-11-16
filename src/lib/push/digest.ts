import { and, count, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import type { getDb } from "@/db";
import { articles, housingNotices, notificationSettings } from "@/db/schema";
import type { VapidConfig } from "./config";
import type { PushPayload } from "./payload";
import { sendToAll, type SendResult } from "./send";

type Db = ReturnType<typeof getDb>;

const DAY_MS = 24 * 60 * 60 * 1000;
/** 오래 쉬었다 보내도 이 기간보다 이전 소식은 세지 않는다. */
const MAX_LOOKBACK_MS = 2 * DAY_MS;

/**
 * 알림 규칙(notification_settings.rule). 지금은 하루 1회 요약만 있다(PRD 17장: 하루 최대 2개).
 * - categoryIds: 있으면 그 카테고리의 뉴스만 센다. 없으면 전체.
 * - lastDigestAt: 마지막으로 요약을 보낸 시각(다음 요약은 이 뒤의 새 소식만 센다).
 */
export const digestRuleSchema = z.object({
  kind: z.literal("daily_digest").default("daily_digest"),
  categoryIds: z.array(z.number().int()).nullable().default(null),
  includeHousing: z.boolean().default(true),
  lastDigestAt: z.iso.datetime().nullable().default(null),
});
export type DigestRule = z.infer<typeof digestRuleSchema>;

/** 저장된 규칙이 비었거나 깨졌으면 기본 규칙을 쓴다. */
export function parseRule(raw: unknown): DigestRule {
  const r = digestRuleSchema.safeParse(raw ?? {});
  return r.success ? r.data : digestRuleSchema.parse({});
}

/** 이번 요약이 세는 시작 시각: 마지막 발송 이후, 없으면 하루 전. 너무 오래된 값은 잘라낸다. */
export function digestSince(rule: DigestRule, now: Date): Date {
  const floor = now.getTime() - MAX_LOOKBACK_MS;
  const last = rule.lastDigestAt ? Date.parse(rule.lastDigestAt) : now.getTime() - DAY_MS;
  return new Date(Math.max(last, floor));
}

export type DigestCounts = { news: number; housing: number; topTitle: string | null };

/** 새 소식이 없으면 null(보내지 않는다). 투자·전망 표현 없이 개수와 대표 제목만 전한다. */
export function buildDigestPayload(c: DigestCounts): PushPayload | null {
  if (c.news === 0 && c.housing === 0) return null;
  const parts: string[] = [];
  if (c.news > 0) parts.push(`뉴스 ${c.news}개`);
  if (c.housing > 0) parts.push(`청약 공고 ${c.housing}개`);
  let body = `${parts.join(", ")}가 새로 올라왔어요.`;
  if (c.topTitle) {
    const room = 200 - body.length - 1;
    const t = c.topTitle.length > room ? `${c.topTitle.slice(0, Math.max(room - 1, 0))}…` : c.topTitle;
    if (room > 10) body += ` ${t}`;
  }
  return { title: "오늘의 새 소식", body, url: "/" };
}

export type DigestOutcome =
  | { status: "disabled" }
  | { status: "nothing_new" }
  | { status: "no_subscribers" }
  | ({ status: "sent"; counts: DigestCounts } & SendResult)
  | ({ status: "failed"; counts: DigestCounts } & SendResult);

async function loadSetting(db: Db) {
  const [row] = await db
    .select()
    .from(notificationSettings)
    .where(and(eq(notificationSettings.channel, "push"), isNull(notificationSettings.userId)))
    .limit(1);
  return row ?? null;
}

async function countNew(db: Db, rule: DigestRule, since: Date): Promise<DigestCounts> {
  const newsFilter = [gt(articles.fetchedAt, since)];
  if (rule.categoryIds && rule.categoryIds.length > 0) {
    newsFilter.push(inArray(articles.categoryId, rule.categoryIds));
  }
  const [{ n }] = await db
    .select({ n: count() })
    .from(articles)
    .where(and(...newsFilter));
  const [top] = await db
    .select({ title: articles.titleKo })
    .from(articles)
    .where(and(...newsFilter))
    .orderBy(desc(articles.fetchedAt))
    .limit(1);

  let housing = 0;
  if (rule.includeHousing) {
    const [h] = await db.select({ n: count() }).from(housingNotices).where(gt(housingNotices.fetchedAt, since));
    housing = h.n;
  }
  return { news: n, housing, topTitle: top?.title ?? null };
}

/**
 * 하루 1회 요약 알림. 새 소식이 있고 받는 기기가 있을 때만 보내고,
 * 한 대 이상 성공했을 때만 "마지막 발송 시각"을 앞으로 옮긴다(전부 실패하면 다음 실행에서 다시 시도).
 */
export async function sendDigest(
  db: Db,
  vapid: VapidConfig,
  now: Date = new Date(),
  send?: Parameters<typeof sendToAll>[3],
): Promise<DigestOutcome> {
  const setting = await loadSetting(db);
  if (setting && !setting.enabled) return { status: "disabled" };

  const rule = parseRule(setting?.rule);
  const counts = await countNew(db, rule, digestSince(rule, now));
  const payload = buildDigestPayload(counts);
  if (!payload) return { status: "nothing_new" };

  const result = await sendToAll(db, vapid, payload, send);
  if (result.sent + result.removed + result.failed === 0) return { status: "no_subscribers" };
  if (result.sent === 0) return { status: "failed", counts, ...result };

  const next: DigestRule = { ...rule, lastDigestAt: now.toISOString() };
  if (setting) {
    await db.update(notificationSettings).set({ rule: next }).where(eq(notificationSettings.id, setting.id));
  } else {
    await db.insert(notificationSettings).values({ userId: null, channel: "push", rule: next, enabled: true });
  }
  return { status: "sent", counts, ...result };
}
