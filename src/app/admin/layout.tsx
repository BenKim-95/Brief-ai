import type { ReactNode } from "react";
import { AdminApiProvider } from "./admin-api";
import { AdminGate } from "./admin-gate";
import { AdminShell } from "./admin-shell";

/** 관리 화면 공통 틀. 처음 열면 잠금 화면(AdminGate)이 나오고, 관리 토큰으로 잠금을 풀어야 안쪽이 보인다. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminApiProvider>
      <div className="mx-auto min-h-screen w-full max-w-3xl px-4 py-5">
        <AdminGate>
          <AdminShell>{children}</AdminShell>
        </AdminGate>
      </div>
    </AdminApiProvider>
  );
}
