"use client";

import { ExternalLink, House, Lock, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAdminApi } from "./admin-api";
import { ADMIN_TABS } from "./admin-menu";

/** 잠금이 풀린 뒤의 관리 화면 틀: 위쪽 바(사이트 보기·잠금)와 이동 탭. */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { setToken } = useAdminApi();
  return (
    <>
      <header className="flex items-center justify-between gap-2 pb-3">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-primary-foreground">
            <ShieldCheck className="size-[18px]" aria-hidden />
          </span>
          브리프 관리
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-sm font-bold"
          >
            <House className="size-4" aria-hidden />
            사이트 보기
          </Link>
          <button
            type="button"
            onClick={() => setToken("")}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-sm font-bold text-no"
          >
            <Lock className="size-4" aria-hidden />
            잠금
          </button>
        </div>
      </header>

      <nav aria-label="관리 메뉴 바로가기" className="sticky top-0 z-10 -mx-4 mb-5 flex gap-2 overflow-x-auto bg-app/95 px-4 py-2 backdrop-blur">
        {ADMIN_TABS.map((t) => {
          const active = t.href === "/admin" ? pathname === "/admin" : pathname === t.href || pathname.startsWith(`${t.href}/`);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold ${
                active ? "bg-brand text-primary-foreground" : "border border-line bg-surface text-ink"
              }`}
            >
              <Icon className="size-4" aria-hidden />
              {t.label}
              {t.href === "/notifications" && <ExternalLink className="size-3 opacity-60" aria-hidden />}
            </Link>
          );
        })}
      </nav>

      <main>{children}</main>
    </>
  );
}
