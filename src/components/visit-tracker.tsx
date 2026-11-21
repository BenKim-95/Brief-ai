"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { ADMIN_TOKEN_KEY } from "@/app/admin/admin-api";
import { detectSource } from "@/components/error-reporter";

/** 이 브라우저에 관리 토큰이 있으면 관리자의 화면 열기로 보고 세지 않는다. */
function looksLikeAdmin(): boolean {
  try {
    return !!(localStorage.getItem(ADMIN_TOKEN_KEY) ?? sessionStorage.getItem(ADMIN_TOKEN_KEY));
  } catch {
    return false;
  }
}

/**
 * 화면을 열 때마다 서버에 1회 알려 하루 방문자수·트래픽을 센다(관리 화면 /admin 에서 확인).
 * 운영 빌드에서만 보내고(개발 중 화면 열기가 운영 DB에 쌓이지 않게), 관리자·/admin 은 보내지 않는다.
 * 화면에는 아무것도 그리지 않는다.
 */
export function VisitTracker() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!pathname || pathname.startsWith("/admin") || last.current === pathname) return;
    if (looksLikeAdmin()) return;
    last.current = pathname;
    try {
      void fetch("/api/analytics/visit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ path: pathname, source: detectSource() }),
      }).catch(() => {});
    } catch {}
  }, [pathname]);

  return null;
}
