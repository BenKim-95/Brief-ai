import { z } from "zod";

/**
 * 오류 코드. 같은 원인의 오류는 늘 같은 코드가 되도록, 메시지에서 숫자·주소·긴 영문숫자 조각을 지우고 해시를 만든다.
 *   E-WEB-3F9K2  웹 브라우저에서 난 오류
 *   E-APP-3F9K2  안드로이드·iOS 앱(Capacitor)에서 난 오류
 *   E-SRV-3F9K2  서버(화면을 만들거나 API를 처리하다) 난 오류
 * 클라이언트와 서버가 함께 쓰므로 DB 코드를 끌어오지 않는다.
 */
export const ERROR_SOURCES = ["web", "app", "server"] as const;
export type ErrorSource = (typeof ERROR_SOURCES)[number];

export const SOURCE_LABEL: Record<ErrorSource, string> = { web: "웹", app: "앱", server: "서버" };
const SOURCE_TAG: Record<ErrorSource, string> = { web: "WEB", app: "APP", server: "SRV" };

export const MESSAGE_MAX = 300;
export const STACK_MAX = 2000;
export const PATH_MAX = 200;
export const AGENT_MAX = 200;

/** 같은 원인끼리 묶이도록 값이 달라지는 부분(주소, 숫자, 긴 식별자)을 자리표시자로 바꾼다. */
export function normalizeMessage(message: string): string {
  return message
    .replace(/https?:\/\/\S+/g, "<url>")
    .replace(/\b[0-9a-f]{8,}\b/gi, "<id>")
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MESSAGE_MAX);
}

/** 주소의 쿼리·해시를 떼고, 숫자로만 된 구간은 :id로 바꿔 "/articles/7"과 "/articles/8"을 같은 곳으로 본다. */
export function normalizePath(path: string | null | undefined): string {
  if (!path) return "";
  const noQuery = path.split(/[?#]/)[0];
  const p = noQuery.replace(/^https?:\/\/[^/]+/i, "");
  return p
    .split("/")
    .map((seg) => (/^\d+$/.test(seg) ? ":id" : seg))
    .join("/")
    .slice(0, PATH_MAX);
}

/** FNV-1a 32비트 해시. 암호용이 아니라 같은 오류를 같은 코드로 묶는 용도다. */
function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** 오류의 코드. 같은 출처·같은 메시지(정리 후)·같은 화면 경로이면 같은 코드다. */
export function errorCode(source: ErrorSource, message: string, path?: string | null): string {
  const key = `${source}|${normalizeMessage(message)}|${normalizePath(path)}`;
  // 32비트를 36진수 5자리(대문자)로: 0~60,466,175 범위로 줄여 쓴다.
  const short = (fnv1a(key) % 60_466_176).toString(36).toUpperCase().padStart(5, "0");
  return `E-${SOURCE_TAG[source]}-${short}`;
}

/** 브라우저·앱이 보내는 오류 보고. */
export const clientReportSchema = z.object({
  source: z.enum(["web", "app"]),
  message: z.string().trim().min(1).max(2000),
  stack: z.string().max(10_000).optional(),
  path: z.string().max(500).optional(),
  userAgent: z.string().max(500).optional(),
});
export type ClientReport = z.infer<typeof clientReportSchema>;

export const STATUSES = ["open", "resolved", "ignored"] as const;
export type ErrorStatus = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<ErrorStatus, string> = { open: "처리 전", resolved: "해결됨", ignored: "무시" };
