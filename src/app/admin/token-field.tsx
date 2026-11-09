"use client";

import { useAdminApi } from "./admin-api";

export function TokenField() {
  const { token, setToken } = useAdminApi();
  return (
    <label className="mb-6 block text-sm">
      관리 토큰 (.env.local의 ADMIN_TOKEN)
      <input
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        className="mt-1 block min-h-11 w-full rounded border px-3 text-base"
        autoComplete="off"
      />
    </label>
  );
}
