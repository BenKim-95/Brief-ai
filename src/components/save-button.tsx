"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { ADMIN_TOKEN_KEY } from "@/app/admin/admin-api";

/**
 * 저장/해제 토글. 관리 API와 같은 토큰을 쓴다(로그인 도입 전까지).
 * 눌렀을 때 바로 바뀌어 보이고(optimistic), 실패하면 원래대로 돌아가며 이유를 보여준다.
 */
export function SaveButton({ articleId, initialSaved }: { articleId: number; initialSaved: boolean }) {
  const router = useRouter();
  const [saved, setSaved] = useOptimistic(initialSaved);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function toggle() {
    const next = !saved;
    setError("");
    startTransition(async () => {
      setSaved(next);
      try {
        let token = "";
        try {
          token = localStorage.getItem(ADMIN_TOKEN_KEY) ?? sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? "";
        } catch {}
        if (!token) throw new Error("홈의 토큰 입력칸에 관리 토큰을 먼저 넣어 주세요.");
        const res = await fetch(`/api/saved/${articleId}`, {
          method: next ? "PUT" : "DELETE",
          headers: { "x-admin-token": token },
        });
        if (res.status === 401) throw new Error("토큰이 맞지 않아요. 다시 입력해 주세요.");
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
      {error && (
        <p role="alert" className="mt-1 text-xs text-no">
          ⚠ {error}
        </p>
      )}
    </div>
  );
}
