import { and, eq, exists, lt, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { getDb } from "@/db";
import { siteVisits } from "@/db/schema";
import { normalizePath } from "@/lib/errors/code";

type Db = ReturnType<typeof getDb>;

/** 방문 기록은 이 기간만 보관한다(뉴스 크론이 정리). */
export const KEEP_DAYS = 90;
export const TRAFFIC_RANGES = [7, 14, 30] as const;
export type TrafficRange = (typeof TRAFFIC_RANGES)[number];

export const VISIT_SOURCES = ["web", "app"] as const;
export type VisitSource = (typeof VISIT_SOURCES)[number];

const KST_MS = 9 * 3_600_000;
const DAY_MS = 86_400_000;

/** 한국 시간 기준 날짜(YYYY-MM-DD). */
export function kstDayOf(now: Date): string {
  return new Date(now.getTime() + KST_MS).toISOString().slice(0, 10);
}

/** 한국 시간 기준 시(0~23). */
export function kstHourOf(now: Date): number {
  return new Date(now.getTime() + KST_MS).getUTCHours();
}

/** 봇·크롤러·미리보기 로봇처럼 사람이 아닌 요청이면 true. 주소 미리보기는 사람이 연 화면이 아니라서 센다고 볼 수 없다. */
export function isBotAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true;
  return /bot|crawl|spider|slurp|preview|lighthouse|monitor|curl\/|wget\/|python-requests|facebookexternalhit|kakaotalk-scrap/i.test(
    userAgent,
  );
}

/**
 * 기록할 화면 경로로 정리한다. 쿼리·해시는 떼고 숫자 구간은 :id 로 합친다.
 * 관리 화면(/admin)·API·내부 경로·올바르지 않은 값은 null(= 세지 않는다).
 */
export function cleanVisitPath(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 300) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  const p = normalizePath(raw);
  if (!p.startsWith("/")) return null;
  if (/^\/(admin|api|_next)(\/|$)/.test(p)) return null;
  return p.length > 1 ? p.replace(/\/+$/, "") || "/" : p;
}

/** 방문 1건을 기록한다. */
export async function recordVisit(
  db: Db,
  input: { visitorId: string; path: string; source: VisitSource },
  now = new Date(),
): Promise<void> {
  await db.insert(siteVisits).values({
    day: kstDayOf(now),
    hour: kstHourOf(now),
    visitorId: input.visitorId,
    path: input.path,
    source: input.source,
  });
}

export type DayRow = { day: string; visitors: number; pageViews: number };
export type HourRow = { hour: number; visitors: number; pageViews: number };
export type PathRow = { path: string; pageViews: number; visitors: number };

export type TrafficReport = {
  /** 이 보고서가 기준으로 삼은 오늘(한국 시간). */
  today: string;
  range: TrafficRange;
  /** 오늘과 어제 비교용. */
  todayTotals: { visitors: number; pageViews: number; newVisitors: number; returningVisitors: number };
  yesterdayTotals: { visitors: number; pageViews: number };
  /** 오래된 날 → 오늘 순서. 기록이 없는 날도 0으로 채운다. */
  daily: DayRow[];
  /** 0~23시 전부(없는 시간은 0). 오늘 기준. */
  hourlyToday: HourRow[];
  /** 선택한 기간(range일)에 많이 열린 화면. */
  topPaths: PathRow[];
  /** 선택한 기간의 웹/앱 페이지뷰. */
  sources: Record<VisitSource, number>;
  /** 선택한 기간 전체의 방문자(중복 없이)와 페이지뷰. */
  rangeTotals: { visitors: number; pageViews: number };
};

/** 날짜 문자열에서 n일 전(음수면 후) 날짜. */
export function shiftDay(day: string, deltaDays: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + deltaDays * DAY_MS).toISOString().slice(0, 10);
}

/** 시작~끝 날짜(포함) 목록. */
export function dayList(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = shiftDay(d, 1)) out.push(d);
  return out;
}

/** 빈 날·빈 시간을 0으로 채워 화면에서 그대로 그릴 수 있게 한다. 순수 함수. */
export function fillDays(rows: DayRow[], from: string, to: string): DayRow[] {
  const by = new Map(rows.map((r) => [r.day, r]));
  return dayList(from, to).map((day) => by.get(day) ?? { day, visitors: 0, pageViews: 0 });
}
export function fillHours(rows: HourRow[]): HourRow[] {
  const by = new Map(rows.map((r) => [r.hour, r]));
  return Array.from({ length: 24 }, (_, hour) => by.get(hour) ?? { hour, visitors: 0, pageViews: 0 });
}

/** 하루 방문자수·페이지뷰와 시간대·인기 화면을 모아서 돌려준다. */
export async function getTraffic(db: Db, range: TrafficRange = 14, now = new Date()): Promise<TrafficReport> {
  const today = kstDayOf(now);
  const from = shiftDay(today, -(range - 1));
  const yesterday = shiftDay(today, -1);

  const dailyRows = await db
    .select({
      day: siteVisits.day,
      visitors: sql<number>`count(distinct ${siteVisits.visitorId})::int`,
      pageViews: sql<number>`count(*)::int`,
    })
    .from(siteVisits)
    .where(sql`${siteVisits.day} >= ${from}`)
    .groupBy(siteVisits.day);

  const hourRows = await db
    .select({
      hour: siteVisits.hour,
      visitors: sql<number>`count(distinct ${siteVisits.visitorId})::int`,
      pageViews: sql<number>`count(*)::int`,
    })
    .from(siteVisits)
    .where(sql`${siteVisits.day} = ${today}`)
    .groupBy(siteVisits.hour);

  const pathRows = await db
    .select({
      path: siteVisits.path,
      pageViews: sql<number>`count(*)::int`,
      visitors: sql<number>`count(distinct ${siteVisits.visitorId})::int`,
    })
    .from(siteVisits)
    .where(sql`${siteVisits.day} >= ${from}`)
    .groupBy(siteVisits.path)
    .orderBy(sql`count(*) desc`, siteVisits.path)
    .limit(10);

  const sourceRows = await db
    .select({ source: siteVisits.source, pageViews: sql<number>`count(*)::int` })
    .from(siteVisits)
    .where(sql`${siteVisits.day} >= ${from}`)
    .groupBy(siteVisits.source);

  const [rangeTotals] = await db
    .select({
      visitors: sql<number>`count(distinct ${siteVisits.visitorId})::int`,
      pageViews: sql<number>`count(*)::int`,
    })
    .from(siteVisits)
    .where(sql`${siteVisits.day} >= ${from}`);

  // 오늘 온 사람 중 이전(보관 기간 안)에도 온 적이 있는 사람 = 다시 온 방문자.
  const prev = alias(siteVisits, "prev");
  const [returning] = await db
    .select({ n: sql<number>`count(distinct ${siteVisits.visitorId})::int` })
    .from(siteVisits)
    .where(
      and(
        eq(siteVisits.day, today),
        exists(
          db
            .select({ one: sql`1` })
            .from(prev)
            .where(and(eq(prev.visitorId, siteVisits.visitorId), lt(prev.day, today))),
        ),
      ),
    );

  const daily = fillDays(dailyRows, from, today);
  const todayRow = daily.find((d) => d.day === today) ?? { visitors: 0, pageViews: 0 };
  const yRow = daily.find((d) => d.day === yesterday) ?? { visitors: 0, pageViews: 0 };
  const returningVisitors = Math.min(returning?.n ?? 0, todayRow.visitors);

  const sources: Record<VisitSource, number> = { web: 0, app: 0 };
  for (const r of sourceRows) if (r.source === "web" || r.source === "app") sources[r.source] = r.pageViews;

  return {
    today,
    range,
    todayTotals: {
      visitors: todayRow.visitors,
      pageViews: todayRow.pageViews,
      newVisitors: todayRow.visitors - returningVisitors,
      returningVisitors,
    },
    yesterdayTotals: { visitors: yRow.visitors, pageViews: yRow.pageViews },
    daily,
    hourlyToday: fillHours(hourRows),
    topPaths: pathRows,
    sources,
    rangeTotals: rangeTotals ?? { visitors: 0, pageViews: 0 },
  };
}

/** 보관 기간이 지난 방문 기록을 지운다. 지운 개수를 돌려준다. */
export async function pruneVisits(db: Db, keepDays = KEEP_DAYS, now = new Date()): Promise<number> {
  const cutoff = shiftDay(kstDayOf(now), -keepDays);
  const gone = await db.delete(siteVisits).where(sql`${siteVisits.day} < ${cutoff}`).returning({ id: siteVisits.id });
  return gone.length;
}
