"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminApiProvider, useAdminApi } from "@/app/admin/admin-api";
import { Button } from "@/components/ui/button";

type FetchResult = {
  inserted: number;
  updated: number;
  images?: { filled: number; error?: string };
  results: { name: string; ok: boolean; error?: string }[];
};

function Inner() {
  const { token, call } = useAdminApi();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failures, setFailures] = useState<FetchResult["results"]>([]);

  async function run() {
    setBusy(true);
    setMessage("");
    setFailures([]);
    try {
      const r = await call<FetchResult>("/api/housing/fetch", { method: "POST" });
      const failed = r.results.filter((x) => !x.ok);
      setFailures(failed);
      setMessage(
        r.results.length === 0
          ? "켜져 있는 청약 API가 없어요. 관리 화면에서 등록해 주세요."
          : `새 공고 ${r.inserted}건, 일정 갱신 ${r.updated}건이에요.${r.images?.filled ? ` 사진 ${r.images.filled}장을 찾았어요.` : ""}`,
      );
      router.refresh();
    } catch (e) {
      setMessage(`⚠ ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-5">
      <Button
        onClick={() => void run()}
        disabled={busy || !token}
        className="min-h-11 w-full text-base"
      >
        {busy ? "가져오는 중이에요…" : "청약 정보 가져오기"}
      </Button>
      <div aria-live="polite" className="mt-2 text-sm">
        {message && <p>{message}</p>}
        {failures.length > 0 && (
          <ul className="mt-1 text-red-700">
            {failures.map((f) => (
              <li key={f.name}>
                ⚠ {f.name}: {f.error}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function FetchButton() {
  return (
    <AdminApiProvider>
      <Inner />
    </AdminApiProvider>
  );
}
