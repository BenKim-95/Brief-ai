import Link from "next/link";
import type { ReactNode } from "react";
import { AdminApiProvider } from "./admin-api";
import { TokenField } from "./token-field";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminApiProvider>
      <div className="mx-auto max-w-xl px-4 py-6">
        <h1 className="mb-4 text-xl font-bold">관리</h1>
        <nav className="mb-4 flex gap-4 text-base">
          <Link href="/admin/sources" className="underline">
            소스
          </Link>
          <Link href="/admin/categories" className="underline">
            카테고리
          </Link>
        </nav>
        <TokenField />
        {children}
      </div>
    </AdminApiProvider>
  );
}
