import Link from "next/link";
import type { ReactNode } from "react";
import { AdminApiProvider } from "./admin-api";
import { TokenField } from "./token-field";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminApiProvider>
      <div className="mx-auto max-w-xl px-4 py-6">
        <h1 className="mb-4 text-xl font-bold">관리</h1>
        <nav className="mb-4 flex flex-wrap gap-x-4 gap-y-2 text-base">
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
            커뮤니티 신고
          </Link>
          <Link href="/housing" className="underline">
            청약 화면 →
          </Link>
        </nav>
        <TokenField />
        {children}
      </div>
    </AdminApiProvider>
  );
}
