import Link from "next/link";
import type { ReactNode } from "react";
import { AdminOnly } from "@/components/admin-only";
import { AdminApiProvider } from "./admin-api";
import { TokenField } from "./token-field";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminApiProvider>
      <div className="mx-auto max-w-xl px-4 py-6">
        <h1 className="mb-4 text-xl font-bold">관리</h1>
        <TokenField />
        {/* 관리 화면은 관리자만 쓴다. 토큰이 없거나 틀리면 아래 안내만 보이고, 토큰을 맞게 넣으면 바로 나타난다. */}
        <AdminOnly
          fallback={
            <p role="note" className="rounded-lg border p-4 text-sm">
              관리자만 쓸 수 있는 화면이에요. 위 칸에 관리 토큰을 입력해 주세요.
            </p>
          }
        >
          <nav className="mb-4 flex flex-wrap gap-x-4 gap-y-2 text-base">
            <Link href="/admin" className="underline">
              관리 메뉴
            </Link>
            <Link href="/admin/errors" className="underline">
              오류·이슈
            </Link>
            <Link href="/admin/sources" className="underline">
              소스
            </Link>
            <Link href="/admin/categories" className="underline">
              카테고리
            </Link>
            <Link href="/admin/housing-feeds" className="underline">
              청약 API
            </Link>
            <Link href="/admin/housing-categories" className="underline">
              청약 카테고리
            </Link>
            <Link href="/admin/community" className="underline">
              제보 기사 신고
            </Link>
            <Link href="/notifications" className="underline">
              알림 설정
            </Link>
            <Link href="/housing" className="underline">
              청약 화면 →
            </Link>
          </nav>
          {children}
        </AdminOnly>
      </div>
    </AdminApiProvider>
  );
}
