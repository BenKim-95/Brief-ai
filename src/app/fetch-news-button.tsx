"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminApiProvider, useAdminApi } from "@/app/admin/admin-api";

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

  async function fillInsights() {
    setBusy(true);
    setMessage("");
    setProblems([]);
    try {
      // 서버는 한 번에 시간 안에 끝낼 만큼만 처리하므로, 남은 게 있으면 이어서 다시 요청한다(최대 40번).
      type R = { filled: number; remaining: number; failedBatches: string[] };
      let total = 0;
      let last: R = { filled: 0, remaining: 0, failedBatches: [] };
      const failures: string[] = [];
      for (let round = 1; round <= 40; round++) {
        last = await call<R>("/api/news/insights", {
          method: "POST",
          busyLabel: total > 0 ? `AI 해설을 만드는 중이에요… (${total}개 완료, ${last.remaining}개 남음)` : "AI 해설을 만드는 중이에요…",
        });
        total += last.filled;
        failures.push(...last.failedBatches);
        setMessage(`AI 해설을 채우는 중이에요… ${total}개 완료${last.remaining > 0 ? `, ${last.remaining}개 남음` : ""}`);
        // 다 채웠거나, 이번 요청에서 하나도 못 채웠으면(오류 반복) 멈춘다.
        if (last.remaining === 0 || last.filled === 0) break;
      }
      setProblems([...new Set(failures)]);
      setMessage(
        total === 0 && last.remaining === 0
          ? "해설이 필요한 소식이 없어요."
          : `소식 ${total}개에 AI 해설을 채웠어요.` +
              (last.remaining > 0 ? ` ${last.remaining}개는 못 채웠어요. 잠시 뒤 다시 눌러 주세요.` : ""),
      );
      router.refresh();
    } catch (e) {
      setMessage(`⚠ ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy || !token}
        className="flex min-h-12 w-full items-center justify-center rounded-full border border-brand px-5 text-base font-bold text-brand disabled:opacity-50"
      >
        {busy ? "처리 중이에요… (최대 1분)" : "뉴스 가져오기"}
      </button>
      <button
        type="button"
        onClick={() => void fillInsights()}
        disabled={busy || !token}
        className="mt-2 flex min-h-11 w-full items-center justify-center rounded-full border border-line px-5 text-sm text-sub disabled:opacity-50"
      >
        AI 해설 채우기 (해설이 없는 소식)
      </button>
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
