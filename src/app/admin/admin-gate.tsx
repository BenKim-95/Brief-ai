"use client";

import { Eye, EyeOff, KeyRound, Lock } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useAdminApi } from "./admin-api";

type Check = "ok" | "bad" | "unset" | "offline";

/** 서버에 토큰이 맞는지만 묻는다(GET /api/admin/check). */
async function checkToken(token: string): Promise<Check> {
  try {
    const res = await fetch("/api/admin/check", { headers: { "x-admin-token": token }, cache: "no-store" });
    if (res.ok) return "ok";
    if (res.status === 503) return "unset";
    return "bad";
  } catch {
    return "offline";
  }
}

const MESSAGE: Record<Exclude<Check, "ok">, string> = {
  bad: "토큰이 맞지 않아요. 다시 확인해 주세요.",
  unset: "서버에 ADMIN_TOKEN이 설정되지 않았어요. 배포 환경 변수를 먼저 확인해 주세요.",
  offline: "서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.",
};

/**
 * 관리 화면의 잠금 장치. 이 브라우저에 맞는 토큰이 저장돼 있으면 바로 열리고,
 * 아니면 ADMIN_TOKEN을 입력해 "잠금 해제"를 눌러야 안쪽 화면이 보인다(토큰은 서버에서 확인한 뒤에만 저장한다).
 * 화면을 가리는 것일 뿐 진짜 보호는 각 관리 API 의 토큰 검사가 맡는다.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const { token, setToken } = useAdminApi();
  // 서버가 맞다고 확인해 준 토큰. 저장된 토큰이 이것과 같을 때만 안쪽을 보여 준다.
  const [verified, setVerified] = useState("");
  const [draft, setDraft] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // 저장된 토큰이 아직 확인되지 않았다면(처음 열 때, 다른 탭에서 바뀌었을 때) 서버에 확인한다. 틀렸으면 지우고 잠근다.
  useEffect(() => {
    if (!token || token === verified) return;
    let alive = true;
    void checkToken(token).then((r) => {
      if (!alive) return;
      if (r === "ok") return setVerified(token);
      if (r === "bad") setToken("");
      // 서버에 닿지 못한 경우엔 저장된 토큰은 그대로 두고 잠금 화면에서 다시 시도하게 한다.
      setError(r === "bad" ? "저장돼 있던 토큰이 더 이상 맞지 않아요. 다시 입력해 주세요." : MESSAGE[r]);
    });
    return () => {
      alive = false;
    };
  }, [token, verified, setToken]);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    const t = draft.trim();
    if (!t || busy) return;
    setBusy(true);
    setError("");
    const r = await checkToken(t);
    setBusy(false);
    if (r !== "ok") {
      setError(MESSAGE[r]);
      return;
    }
    setVerified(t);
    setToken(t);
    setDraft("");
  }

  // 토큰이 지워지면(잠금 버튼, 서버가 401로 거절) 자동으로 다시 잠긴다.
  if (token && token === verified) return <>{children}</>;
  if (token && !error) {
    return (
      <p role="status" className="py-24 text-center text-sm text-sub">
        관리자 확인 중이에요…
      </p>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-1 py-10">
      <form onSubmit={(e) => void unlock(e)} className="rounded-[22px] border border-line bg-surface p-6 shadow-sm" aria-labelledby="gate-title">
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-brand-weak text-brand">
          <Lock className="size-6" aria-hidden />
        </div>
        <h2 id="gate-title" className="text-xl font-bold">
          관리자 잠금
        </h2>
        <p role="note" className="mt-1 text-sm text-sub">
          관리자만 쓸 수 있는 화면이에요. 서버에 설정한 관리 토큰(ADMIN_TOKEN)을 입력하면 잠금이 풀려요.
        </p>

        <label htmlFor="gate-token" className="mt-5 block text-sm font-bold">
          관리 토큰
        </label>
        <div className="relative mt-1.5">
          <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-sub" aria-hidden />
          <input
            id="gate-token"
            type={show ? "text" : "password"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoComplete="off"
            autoFocus
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "gate-error" : undefined}
            className="min-h-12 w-full rounded-xl border border-line bg-app pl-10 pr-12 text-base outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "토큰 가리기" : "토큰 보기"}
            aria-pressed={show}
            className="absolute right-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-sub"
          >
            {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        </div>
        {error && (
          <p id="gate-error" role="alert" className="mt-2 text-sm text-no">
            ⚠ {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!draft.trim() || busy}
          className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl bg-brand text-base font-bold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "확인 중이에요…" : "잠금 해제"}
        </button>
        <p className="mt-3 text-center text-xs text-sub">이 브라우저에는 잠금을 푼 상태가 저장돼요. 공용 기기라면 쓰고 나서 &quot;잠금&quot;을 눌러 주세요.</p>
      </form>
      <Link href="/" className="mt-4 text-center text-sm text-sub underline">
        ← 사이트로 돌아가기
      </Link>
    </div>
  );
}
