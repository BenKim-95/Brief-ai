"use client";

import { ErrorScreen } from "@/components/error-screen";
import "./globals.css";

/** 맨 바깥 레이아웃에서 난 오류. 레이아웃이 없으므로 html·body를 직접 그린다. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ko">
      <body className="min-h-full flex flex-col">
        <ErrorScreen error={error} reset={reset} />
      </body>
    </html>
  );
}
