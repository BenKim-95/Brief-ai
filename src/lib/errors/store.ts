import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { getDb } from "@/db";
import { articles, errorEvents, housingNotices } from "@/db/schema";
import {
  AGENT_MAX,
  MESSAGE_MAX,
  PATH_MAX,
  STACK_MAX,
  errorCode,
  normalizePath,
  type ErrorSource,
  type ErrorStatus,
} from "./code";

type Db = ReturnType<typeof getDb>;

/** 서로 다른 오류 코드를 이만큼까지만 저장한다(보고를 마구 보내 DB를 채우는 일을 막는다). 이미 있는 코드는 계속 센다. */
export const MAX_CODES = 500;

export type ErrorInput = {
  source: ErrorSource;
  message: string;
  stack?: string | null;
  path?: string | null;
  userAgent?: string | null;
};

/**
 * 오류 한 건을 기록한다. 같은 코드면 횟수만 늘리고(해결로 표시된 것이 다시 나면 '처리 전'으로 되돌린다),
 * 새 코드는 MAX_CODES 안에서만 만든다. 기록하다 실패해도 던지지 않는다(오류 기록이 또 오류를 만들면 안 되므로).
 * 돌려주는 값은 오류 코드.
 */
export async function recordError(db: Db, input: ErrorInput, now = new Date()): Promise<string> {
  const message = input.message.replace(/\s+/g, " ").trim().slice(0, MESSAGE_MAX) || "(메시지 없음)";
  const path = normalizePath(input.path).slice(0, PATH_MAX);
  const code = errorCode(input.source, message, path);
  try {
    const bumped = await db
      .update(errorEvents)
      .set({
        count: sql`${errorEvents.count} + 1`,
        lastSeenAt: now,
        status: sql`case when ${errorEvents.status} = 'resolved' then 'open' else ${errorEvents.status} end`,
        resolvedAt: sql`case when ${errorEvents.status} = 'resolved' then null else ${errorEvents.resolvedAt} end`,
      })
      .where(eq(errorEvents.code, code))
      .returning({ id: errorEvents.id });
    if (bumped.length > 0) return code;

    const [total] = await db.select({ n: sql<number>`count(*)::int` }).from(errorEvents);
    if ((total?.n ?? 0) >= MAX_CODES) return code;
    await db
      .insert(errorEvents)
      .values({
        code,
        source: input.source,
        message,
        stack: input.stack ? input.stack.slice(0, STACK_MAX) : null,
        path: path || null,
        userAgent: input.userAgent ? input.userAgent.slice(0, AGENT_MAX) : null,
        firstSeenAt: now,
        lastSeenAt: now,
      })
      // 동시에 같은 코드가 처음 들어온 경우: 횟수만 올린다.
      .onConflictDoUpdate({ target: errorEvents.code, set: { count: sql`${errorEvents.count} + 1`, lastSeenAt: now } });
  } catch {
    // 기록 실패는 삼킨다.
  }
  return code;
}

export type ErrorRow = typeof errorEvents.$inferSelect;

export async function listErrors(db: Db, opts: { status?: ErrorStatus; source?: ErrorSource } = {}): Promise<ErrorRow[]> {
  return db
    .select()
    .from(errorEvents)
    .where(
      and(
        opts.status ? eq(errorEvents.status, opts.status) : undefined,
        opts.source ? eq(errorEvents.source, opts.source) : undefined,
      ),
    )
    .orderBy(desc(errorEvents.lastSeenAt))
    .limit(200);
}

export async function setStatus(db: Db, id: number, status: ErrorStatus, now = new Date()): Promise<boolean> {
  const rows = await db
    .update(errorEvents)
    .set({ status, resolvedAt: status === "resolved" ? now : null })
    .where(eq(errorEvents.id, id))
    .returning({ id: errorEvents.id });
  return rows.length > 0;
}

export async function removeError(db: Db, id: number): Promise<boolean> {
  const rows = await db.delete(errorEvents).where(eq(errorEvents.id, id)).returning({ id: errorEvents.id });
  return rows.length > 0;
}

export type Summary = {
  /** 처리 전 오류 코드 수 */
  open: number;
  /** 최근 24시간 안에 다시 난 오류 코드 수 (출처별) */
  last24h: Record<ErrorSource, number>;
};

export async function summarize(db: Db, now = new Date()): Promise<Summary> {
  const since = new Date(now.getTime() - 24 * 3_600_000);
  const [open] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(errorEvents)
    .where(eq(errorEvents.status, "open"));
  const rows = await db
    .select({ source: errorEvents.source, n: sql<number>`count(*)::int` })
    .from(errorEvents)
    .where(and(gte(errorEvents.lastSeenAt, since), eq(errorEvents.status, "open")))
    .groupBy(errorEvents.source);
  const last24h: Summary["last24h"] = { web: 0, app: 0, server: 0 };
  for (const r of rows) if (r.source in last24h) last24h[r.source as ErrorSource] = r.n;
  return { open: open?.n ?? 0, last24h };
}

/** 서버 설정 점검: 값 자체는 내보내지 않고 "들어 있는지"만. */
export const ENV_CHECKS: { name: string; label: string; needed: string }[] = [
  { name: "DATABASE_URL", label: "데이터베이스", needed: "모든 화면" },
  { name: "ADMIN_TOKEN", label: "관리 토큰", needed: "관리 기능" },
  { name: "ANTHROPIC_API_KEY", label: "Claude 키", needed: "뉴스 가져오기·AI 해설" },
  { name: "DATA_GO_KR_SERVICE_KEY", label: "청약홈 API 키", needed: "청약 정보 가져오기" },
  { name: "NAVER_CLIENT_ID", label: "네이버 이미지 검색 ID", needed: "청약 사진" },
  { name: "NAVER_CLIENT_SECRET", label: "네이버 이미지 검색 비밀키", needed: "청약 사진" },
  { name: "CRON_SECRET", label: "자동 수집 비밀값", needed: "매일 자동 수집(Vercel Cron)" },
  { name: "SITE_URL", label: "사이트 주소", needed: "메일 링크·공유 미리보기" },
  { name: "RESEND_API_KEY", label: "Resend 키", needed: "이메일 알림" },
  { name: "NEXT_PUBLIC_VAPID_PUBLIC_KEY", label: "푸시 공개키", needed: "웹 푸시" },
  { name: "VAPID_PRIVATE_KEY", label: "푸시 비밀키", needed: "웹 푸시" },
];

export type Health = {
  db: { ok: boolean; error?: string };
  env: { name: string; label: string; needed: string; set: boolean }[];
  /** 가장 최근에 들어온 소식·청약 공고 시각(없으면 null) */
  latestArticleAt: string | null;
  latestNoticeAt: string | null;
  /** 사람이 읽을 "확인이 필요한 일" 목록 */
  issues: string[];
};

/** 24시간 넘게 새 소식이 없으면 수집이 멈춘 것으로 본다. */
export const STALE_HOURS = 30;

export async function checkHealth(db: Db, now = new Date()): Promise<Health> {
  const env = ENV_CHECKS.map((c) => ({ ...c, set: !!process.env[c.name]?.trim() }));
  const issues: string[] = [];
  let dbOk = true;
  let dbError: string | undefined;
  let latestArticleAt: Date | null = null;
  let latestNoticeAt: Date | null = null;
  try {
    const [a] = await db.select({ at: sql<Date | null>`max(${articles.fetchedAt})` }).from(articles);
    const [n] = await db.select({ at: sql<Date | null>`max(${housingNotices.fetchedAt})` }).from(housingNotices);
    latestArticleAt = a?.at ? new Date(a.at) : null;
    latestNoticeAt = n?.at ? new Date(n.at) : null;
  } catch (e) {
    dbOk = false;
    dbError = e instanceof Error ? e.message.slice(0, 200) : "연결하지 못했어요";
    issues.push("데이터베이스에 연결하지 못했어요.");
  }
  if (dbOk) {
    if (!latestArticleAt) issues.push("저장된 뉴스가 아직 없어요.");
    else if (now.getTime() - latestArticleAt.getTime() > STALE_HOURS * 3_600_000)
      issues.push(`새 뉴스가 ${STALE_HOURS}시간 넘게 들어오지 않았어요. 자동 수집(크론)이나 Claude 키를 확인해 주세요.`);
  }
  for (const c of env) {
    if (!c.set && ["DATABASE_URL", "ADMIN_TOKEN", "ANTHROPIC_API_KEY", "CRON_SECRET"].includes(c.name))
      issues.push(`${c.label}(${c.name})가 설정되지 않았어요. ${c.needed}이(가) 동작하지 않아요.`);
  }
  return {
    db: { ok: dbOk, error: dbError },
    env,
    latestArticleAt: latestArticleAt?.toISOString() ?? null,
    latestNoticeAt: latestNoticeAt?.toISOString() ?? null,
    issues,
  };
}

/** 오래 해결·무시로 둔 기록은 정리한다(90일). */
export async function pruneErrors(db: Db, keepDays = 90, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - keepDays * 86_400_000);
  const gone = await db
    .delete(errorEvents)
    .where(and(sql`${errorEvents.status} <> 'open'`, sql`${errorEvents.lastSeenAt} < ${cutoff}`))
    .returning({ id: errorEvents.id });
  return gone.length;
}
