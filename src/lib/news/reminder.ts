import { z } from "zod";

/** 한국 시간(UTC+9, 서머타임 없음)으로 "읽을 시간"을 정한다. */
const KST_MS = 9 * 3_600_000;
const DAY_MS = 86_400_000;
export const MAX_DAYS_AHEAD = 365;

export const REMIND_PRESETS = ["evening", "tomorrow", "weekend"] as const;
export type RemindPreset = (typeof REMIND_PRESETS)[number];

export const PRESET_LABELS: Record<RemindPreset, string> = {
  evening: "오늘 저녁 8시",
  tomorrow: "내일 아침 8시",
  weekend: "이번 주말 (토 오전 9시)",
};

/** `when`(미리 정한 시간) 또는 `date`(직접 고른 날, 오전 9시) 중 하나만 받는다. */
export const remindQuerySchema = z
  .object({
    when: z.enum(REMIND_PRESETS).optional(),
    date: z.iso.date().optional(),
  })
  .refine((q) => (q.when ? 1 : 0) + (q.date ? 1 : 0) === 1, {
    message: "when 또는 date 중 하나만 보내 주세요.",
  });

/** KST 달력 날짜와 시각으로 UTC Date 를 만든다. day 는 넘쳐도 된다(Date.UTC 가 이월). */
function kstToUtc(year: number, month: number, day: number, hour: number): Date {
  return new Date(Date.UTC(year, month, day, hour) - KST_MS);
}

/** now 를 KST 로 본 달력 값 */
function kstParts(now: Date) {
  const k = new Date(now.getTime() + KST_MS);
  return {
    y: k.getUTCFullYear(),
    m: k.getUTCMonth(),
    d: k.getUTCDate(),
    h: k.getUTCHours(),
    min: k.getUTCMinutes(),
    dow: k.getUTCDay(), // 0=일 … 6=토
  };
}

/** 오늘 날짜(KST) YYYY-MM-DD */
export function kstToday(now: Date): string {
  return new Date(now.getTime() + KST_MS).toISOString().slice(0, 10);
}

export type RemindResult = { ok: true; at: Date } | { ok: false; error: string };

/**
 * 알림 시각을 계산한다.
 * - evening: 오늘 20:00, 이미 지났으면 내일 20:00
 * - tomorrow: 내일 08:00
 * - weekend: 다음 토요일 09:00 (오늘이 토요일이면 다음 주 토요일)
 * - date: 그 날 09:00. 오늘보다 이전이거나 1년 넘게 먼 날은 거부한다.
 */
export function resolveRemindAt(q: { when?: RemindPreset; date?: string }, now: Date): RemindResult {
  const t = kstParts(now);
  if (q.when === "evening") {
    const today8pm = kstToUtc(t.y, t.m, t.d, 20);
    return { ok: true, at: today8pm.getTime() > now.getTime() ? today8pm : kstToUtc(t.y, t.m, t.d + 1, 20) };
  }
  if (q.when === "tomorrow") return { ok: true, at: kstToUtc(t.y, t.m, t.d + 1, 8) };
  if (q.when === "weekend") {
    const daysToSat = (6 - t.dow + 7) % 7 || 7;
    return { ok: true, at: kstToUtc(t.y, t.m, t.d + daysToSat, 9) };
  }
  if (q.date) {
    const today = kstToday(now);
    if (q.date < today) return { ok: false, error: "지난 날은 고를 수 없어요." };
    const [y, m, d] = q.date.split("-").map(Number);
    const at = kstToUtc(y, m - 1, d, 9);
    const todayStart = Date.parse(`${today}T00:00:00Z`);
    if (Date.parse(`${q.date}T00:00:00Z`) - todayStart > MAX_DAYS_AHEAD * DAY_MS) {
      return { ok: false, error: "1년 안의 날짜만 고를 수 있어요." };
    }
    return { ok: true, at };
  }
  return { ok: false, error: "시간을 정해 주세요." };
}
