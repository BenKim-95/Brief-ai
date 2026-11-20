"use client";

import { useEffect } from "react";
import { errorCode, type ErrorSource } from "@/lib/errors/code";

/** 한 번 연 화면에서 보내는 보고 수 상한(같은 오류가 반복돼도 서버를 두드리지 않게). */
const MAX_PER_PAGE_LOAD = 5;
const sent = new Set<string>();

/** 앱(Capacitor)에서 열렸으면 "app", 아니면 "web". */
export function detectSource(): Extract<ErrorSource, "web" | "app"> {
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    return cap?.isNativePlatform?.() ? "app" : "web";
  } catch {
    return "web";
  }
}

/** 보내지 않을 오류: 브라우저가 알려 주는 잡음, 오프라인일 때의 네트워크 실패, 확장 프로그램 코드. */
export function isNoise(message: string, filename?: string): boolean {
  if (/ResizeObserver loop|^Script error\.?$/i.test(message)) return true;
  if (/failed to fetch|load failed|networkerror|network request failed|the operation was aborted|aborterror/i.test(message)) return true;
  if (filename && /^(chrome|moz|safari)-extension:/i.test(filename)) return true;
  return false;
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message || err.name;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err)?.slice(0, 300) ?? String(err);
  } catch {
    return String(err);
  }
}

/** 이 오류의 코드를 미리 계산한다(오류 화면에 보여 주려고). 서버가 저장하는 코드와 같다. */
export function codeFor(err: unknown): string {
  return errorCode(detectSource(), messageOf(err), window.location.pathname);
}

/** 오류를 서버에 알린다. 코드를 돌려주고, 보내지 않기로 한 오류는 코드만 계산해 돌려준다. */
export function reportClientError(err: unknown, filename?: string): string {
  const message = messageOf(err);
  const source = detectSource();
  const path = window.location.pathname;
  const code = errorCode(source, message, path);
  if (isNoise(message, filename) || sent.has(code) || sent.size >= MAX_PER_PAGE_LOAD) return code;
  sent.add(code);
  try {
    void fetch("/api/errors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        source,
        message,
        stack: err instanceof Error ? err.stack : undefined,
        path,
        userAgent: navigator.userAgent,
      }),
    }).catch(() => {});
  } catch {
    // 보고 실패는 무시
  }
  return code;
}

/** 잡히지 않은 오류와 처리되지 않은 약속 실패를 관리자 오류 화면으로 보낸다. 화면에는 아무것도 그리지 않는다. */
export function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => reportClientError(e.error ?? e.message, e.filename);
    const onRejection = (e: PromiseRejectionEvent) => reportClientError(e.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
