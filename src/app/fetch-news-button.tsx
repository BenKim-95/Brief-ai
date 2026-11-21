"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminApiProvider, useAdminApi } from "@/app/admin/admin-api";
import { Button } from "@/components/ui/button";

type FetchResult = {
  sources: { name: string; ok: boolean; error?: string }[];
  newFound: number;
  inserted: number;
  skippedByCap: number;
  skippedDuplicates: number;
  failedBatches: string[];
};

function Inner() {
  const { token, call } = useAdminApi();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [problems, setProblems] = useState<string[]>([]);

  async function run() {
    setBusy(true);
    setMessage("");
    setProblems([]);
    try {
      const r = await call<FetchResult>("/api/news/fetch", {
        method: "POST",
        busyLabel: "새 소식을 가져오는 중이에요… (최대 1분)",
      });
      setProblems([
        ...r.sources.filter((s) => !s.ok).map((s) => `${s.name}: ${s.error}`),
        ...r.failedBatches,
      ]);
      if (r.sources.length === 0) {
        setMessage("켜져 있는 뉴스 소스가 없어요. 설정에서 등록해 주세요.");
      } else if (r.inserted === 0 && r.newFound === 0) {
        setMessage(
          r.skippedDuplicates > 0
            ? `새 소식이 없어요. (같은 내용 ${r.skippedDuplicates}개는 건너뛰었어요.)`
            : "새 소식이 없어요.",
        );
      } else {
        setMessage(
          `새 소식 ${r.inserted}개를 담았어요.` +
            (r.skippedDuplicates > 0
              ? ` 같은 내용 ${r.skippedDuplicates}개는 건너뛰었어요.`
              : "") +
            (r.skippedByCap > 0
              ? ` ${r.skippedByCap}개는 한 번 더 누르면 가져와요.`
              : ""),
        );
      }
      router.refresh();
    } catch (e) {
      setMessage(`⚠ ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-5">
      <Button onClick={() => void run()} disabled={busy || !token} className="min-h-11 w-full text-base">
        {busy ? "가져오는 중이에요… (최대 1분)" : "뉴스 가져오기"}
      </Button>
      <div aria-live="polite" className="mt-2 text-sm">
        {message && <p className="text-ink">{message}</p>}
        {problems.length > 0 && (
          <ul className="mt-1 text-no">
            {problems.map((p) => (
              <li key={p}>⚠ {p}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function FetchNewsButton() {
  return (
    <AdminApiProvider>
      <Inner />
    </AdminApiProvider>
  );
}
