"use client";

import { useEffect, useState } from "react";
import { codeFor, reportClientError } from "./error-reporter";

/** 화면을 그리다 오류가 났을 때 보여 주는 안내. 오류를 알리고, 사용자가 문의할 때 말할 수 있는 코드를 보여 준다. */
export function ErrorScreen({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [code, setCode] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 오류를 알리면서 받은 코드를 화면에 보여 준다(브라우저에서만 계산)
    setCode(reportClientError(error) || codeFor(error));
  }, [error]);

  return (
    <div className="flex-1 bg-app">
      <main className="mx-auto w-full max-w-[480px] px-5 py-16">
        <h1 className="mb-3 text-[26px] font-bold leading-[1.35]">문제가 생겼어요</h1>
        <p className="mb-2 text-sm text-sub">잠시 뒤에 다시 해 보세요. 계속되면 아래 오류 코드를 알려 주세요.</p>
        {code && (
          <p className="mb-6 text-sm">
            오류 코드 <b data-error-code>{code}</b>
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-bold text-primary-foreground"
          >
            다시 시도
          </button>
          {/* 오류 뒤에는 화면을 처음부터 다시 불러오는 게 안전해서 일부러 <a>를 쓴다(global-error 에서는 next/link 도 쓸 수 없다). */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm text-sub"
          >
            홈으로
          </a>
        </div>
      </main>
    </div>
  );
}
