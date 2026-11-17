import { describe, expect, it } from "vitest";
import { kstToday, remindQuerySchema, resolveRemindAt } from "./reminder";

// 모든 시각은 한국 시간(UTC+9) 기준으로 읽는다. 2026-11-17 은 화요일.
const kst = (s: string) => new Date(`${s}+09:00`);
const at = (q: Parameters<typeof resolveRemindAt>[0], now: Date) => {
  const r = resolveRemindAt(q, now);
  if (!r.ok) throw new Error(r.error);
  return r.at.toISOString();
};

describe("resolveRemindAt", () => {
  it("evening: 아직 8시 전이면 오늘, 지났으면 내일 저녁 8시", () => {
    expect(at({ when: "evening" }, kst("2026-11-17T10:00:00"))).toBe(kst("2026-11-17T20:00:00").toISOString());
    expect(at({ when: "evening" }, kst("2026-11-17T20:00:00"))).toBe(kst("2026-11-18T20:00:00").toISOString());
    expect(at({ when: "evening" }, kst("2026-11-17T23:30:00"))).toBe(kst("2026-11-18T20:00:00").toISOString());
  });

  it("tomorrow: 내일 아침 8시 (한국 새벽 시간대에도 한국 날짜 기준)", () => {
    expect(at({ when: "tomorrow" }, kst("2026-11-17T10:00:00"))).toBe(kst("2026-11-18T08:00:00").toISOString());
    // 한국 시간 00:30 은 UTC 로는 전날 15:30 이지만 한국 날짜 17일이 기준이다
    expect(at({ when: "tomorrow" }, kst("2026-11-17T00:30:00"))).toBe(kst("2026-11-18T08:00:00").toISOString());
  });

  it("weekend: 다음 토요일 오전 9시, 토요일이면 다음 주", () => {
    expect(at({ when: "weekend" }, kst("2026-11-17T10:00:00"))).toBe(kst("2026-11-21T09:00:00").toISOString()); // 화→토
    expect(at({ when: "weekend" }, kst("2026-11-20T10:00:00"))).toBe(kst("2026-11-21T09:00:00").toISOString()); // 금→토
    expect(at({ when: "weekend" }, kst("2026-11-21T07:00:00"))).toBe(kst("2026-11-28T09:00:00").toISOString()); // 토→다음 토
    expect(at({ when: "weekend" }, kst("2026-11-22T10:00:00"))).toBe(kst("2026-11-28T09:00:00").toISOString()); // 일→토
  });

  it("월말과 연말을 넘어가도 날짜가 맞다", () => {
    expect(at({ when: "tomorrow" }, kst("2026-11-30T12:00:00"))).toBe(kst("2026-12-01T08:00:00").toISOString());
    expect(at({ when: "tomorrow" }, kst("2026-12-31T12:00:00"))).toBe(kst("2027-01-01T08:00:00").toISOString());
  });

  it("date: 그 날 오전 9시, 오늘도 가능", () => {
    const now = kst("2026-11-17T10:00:00");
    expect(at({ date: "2026-12-25" }, now)).toBe(kst("2026-12-25T09:00:00").toISOString());
    expect(at({ date: "2026-11-17" }, now)).toBe(kst("2026-11-17T09:00:00").toISOString());
  });

  it("date: 지난 날과 1년을 넘는 날은 이유와 함께 거부", () => {
    const now = kst("2026-11-17T10:00:00");
    expect(resolveRemindAt({ date: "2026-11-16" }, now)).toEqual({ ok: false, error: "지난 날은 고를 수 없어요." });
    expect(resolveRemindAt({ date: "2027-11-17" }, now).ok).toBe(true);
    expect(resolveRemindAt({ date: "2027-11-18" }, now)).toEqual({ ok: false, error: "1년 안의 날짜만 고를 수 있어요." });
  });

  it("kstToday", () => {
    expect(kstToday(new Date("2026-11-16T15:30:00Z"))).toBe("2026-11-17");
  });
});

describe("remindQuerySchema", () => {
  it("when 과 date 중 정확히 하나만 받는다", () => {
    expect(remindQuerySchema.safeParse({ when: "evening" }).success).toBe(true);
    expect(remindQuerySchema.safeParse({ date: "2026-12-01" }).success).toBe(true);
    expect(remindQuerySchema.safeParse({}).success).toBe(false);
    expect(remindQuerySchema.safeParse({ when: "evening", date: "2026-12-01" }).success).toBe(false);
    expect(remindQuerySchema.safeParse({ when: "noon" }).success).toBe(false);
    expect(remindQuerySchema.safeParse({ date: "2026-13-40" }).success).toBe(false);
    expect(remindQuerySchema.safeParse({ date: "내일" }).success).toBe(false);
  });
});
