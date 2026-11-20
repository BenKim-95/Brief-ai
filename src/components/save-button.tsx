"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { useBusy } from "./busy-overlay";

/**
 * 저장/해제 토글. 로그인 없이 이 브라우저(방문자 쿠키)의 저장함에 담긴다.
 * 눌렀을 때 바로 바뀌어 보이고(optimistic), 실패하면 원래대로 돌아가며 이유를 보여준다.
 */
export function SaveButton({
  articleId,
  initialSaved,
  apiBase = "/api/saved",
  removeOnUnsave = false,
}: {
  /** 저장할 항목의 id (기사 id 또는 청약 공고 id) */
  articleId: number;
  initialSaved: boolean;
  /** 저장 API 경로. 청약 공고는 "/api/housing/saved" */
  apiBase?: string;
  /**
   * 저장함 화면용. 저장을 풀면 서버 응답을 기다리지 않고 카드를 바로 숨긴다.
   * 카드(<li>)에 `has-[[data-unsaved]]:hidden` 클래스가 있어야 한다. 실패하면 카드가 다시 나타난다.
   */
  removeOnUnsave?: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useOptimistic(initialSaved);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  useBusy(pending, "처리 중이에요…");

  function toggle() {
    const next = !saved;
    setError("");
    startTransition(async () => {
      setSaved(next);
      try {
        const res = await fetch(`${apiBase}/${articleId}`, {
          method: next ? "PUT" : "DELETE",
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `저장하지 못했어요 (${res.status})`);
        }
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="inline-flex flex-col">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={saved}
        className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-bold disabled:opacity-60 ${
          saved ? "border-brand bg-brand text-primary-foreground" : "border-line text-sub"
        }`}
      >
        {saved ? "★ 저장됨" : "☆ 저장"}
      </button>
      {removeOnUnsave && !saved && <span hidden data-unsaved />}
      {error && (
        <p role="alert" className="mt-1 text-xs text-no">
          ⚠ {error}
        </p>
      )}
    </div>
  );
}
