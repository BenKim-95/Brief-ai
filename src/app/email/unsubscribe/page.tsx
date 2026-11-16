import { Suspense } from "react";
import { UnsubscribeForm } from "./unsubscribe-form";

export const metadata = { title: "수신 해제 · 브리프" };

export default function UnsubscribePage() {
  return (
    <div className="flex-1 bg-app">
      <main className="mx-auto w-full max-w-[480px] px-5 py-10">
        <h1 className="mb-4 text-[26px] font-bold leading-[1.35]">이메일 수신 해제</h1>
        <Suspense fallback={<p className="text-sm text-sub">불러오는 중이에요…</p>}>
          <UnsubscribeForm />
        </Suspense>
      </main>
    </div>
  );
}
