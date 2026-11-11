export type NoticeStatus = "upcoming" | "open" | "closed" | "unknown";

export const STATUS_LABEL: Record<NoticeStatus, string> = {
  upcoming: "◷ 접수 예정",
  open: "● 접수 중",
  closed: "✕ 마감",
  unknown: "? 일정 확인 필요",
};

/** Today's date in Korea as YYYY-MM-DD (청약 일정은 KST 기준). */
export function todayKst(now = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Dates are YYYY-MM-DD strings, so string comparison is date comparison. */
export function noticeStatus(
  receiptStart: string | null,
  receiptEnd: string | null,
  today: string,
): NoticeStatus {
  if (!receiptStart && !receiptEnd) return "unknown";
  if (receiptStart && today < receiptStart) return "upcoming";
  const end = receiptEnd ?? receiptStart!;
  return today > end ? "closed" : "open";
}
