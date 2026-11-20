"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useBusy } from "@/components/busy-overlay";

/** 메일 앱이 링크를 미리 열어 봐도 해제되지 않도록, 버튼을 눌러야 해제한다. */
export function UnsubscribeForm() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  useBusy(state === "busy", "처리 중이에요…");

  if (!token) {
    return <p className="text-sm text-sub">링크가 올바르지 않아요. 메일 속 링크를 다시 눌러 주세요.</p>;
  }
  if (state === "done") {
    return (
      <p role="status" className="rounded-2xl bg-surface p-5 text-sm">
        수신을 해제했어요. 더 이상 메일을 보내지 않아요.
      </p>
    );
  }
  return (
    <div className="rounded-2xl bg-surface p-5">
      <p className="mb-4 text-sm">브리프의 새 소식 메일을 더 받지 않을까요?</p>
      <button
        type="button"
        disabled={state === "busy"}
        className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm disabled:opacity-50"
        onClick={async () => {
          setState("busy");
          try {
            const res = await fetch("/api/email/unsubscribe", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ token }),
            });
            setState(res.ok ? "done" : "error");
          } catch {
            setState("error");
          }
        }}
      >
        수신 해제
      </button>
      {state === "error" && (
        <p role="alert" className="mt-3 text-sm text-sub">
          해제하지 못했어요. 잠시 뒤 다시 눌러 주세요.
        </p>
      )}
    </div>
  );
}
