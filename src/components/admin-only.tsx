"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ADMIN_TOKEN_KEY, ADMIN_TOKEN_EVENT } from "@/app/admin/admin-api";

function readToken(): string {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY) ?? sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * 관리자에게만 보인다. 이 브라우저에 저장된 관리 토큰을 서버에 확인해서(GET /api/admin/check)
 * 맞을 때만 자식을 그린다. 토큰이 없거나 틀리거나 확인 중일 때는 아무것도 그리지 않는다.
 * 토큰을 입력하거나 지우면(같은 화면이든 다른 탭이든) 다시 확인한다.
 *
 * 화면에서 숨기는 것일 뿐 보호는 아니다. 관리 기능의 실제 보호는 각 관리 API 의 토큰 검사가 맡는다.
 */
export function AdminOnly({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let seq = 0;

    function verify() {
      const mine = ++seq;
      const token = readToken();
      if (!token) {
        setIsAdmin(false);
        return;
      }
      fetch("/api/admin/check", { headers: { "x-admin-token": token }, cache: "no-store" })
        .then((res) => {
          if (alive && mine === seq) setIsAdmin(res.ok);
        })
        .catch(() => {
          if (alive && mine === seq) setIsAdmin(false);
        });
    }

    // 토큰을 한 글자씩 입력하는 동안 매번 묻지 않도록 잠깐 기다린다.
    function scheduleVerify() {
      clearTimeout(timer);
      timer = setTimeout(verify, 400);
    }

    verify();
    window.addEventListener(ADMIN_TOKEN_EVENT, scheduleVerify);
    window.addEventListener("storage", scheduleVerify);
    return () => {
      alive = false;
      clearTimeout(timer);
      window.removeEventListener(ADMIN_TOKEN_EVENT, scheduleVerify);
      window.removeEventListener("storage", scheduleVerify);
    };
  }, []);

  return isAdmin ? <>{children}</> : null;
}
