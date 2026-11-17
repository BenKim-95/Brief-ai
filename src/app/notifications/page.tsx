import Link from "next/link";
import { AdminOnly } from "@/components/admin-only";
import { EmailSubscribe } from "@/components/email-subscribe";
import { PushToggle } from "@/components/push-toggle";

export const metadata = { title: "알림 설정 · 브리프" };

export default function NotificationsPage() {
  return (
    <div className="flex-1 bg-app">
      <main className="mx-auto w-full max-w-[480px] px-5 pb-16">
        <header className="flex items-center justify-between pt-5">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm text-sub"
          >
            ← 홈
          </Link>
        </header>
        <h1 className="mt-5 mb-4 text-[26px] font-bold leading-[1.35]">알림 설정</h1>
        {/* 알림 켜기와 이메일 주소 등록은 관리 토큰이 있어야 해서, 관리자에게만 보여준다. */}
        <AdminOnly
          fallback={
            <p role="note" className="rounded-2xl bg-surface p-5 text-sm text-sub">
              알림 설정은 관리자만 바꿀 수 있어요.
            </p>
          }
        >
          <div className="flex flex-col gap-4">
            <PushToggle />
            <EmailSubscribe />
          </div>
          <p className="mt-6 text-xs text-sub">
            알림은 확인할 가치가 있는 소식만 하루에 많아야 두 번 보내요. 언제든 끌 수 있어요.
          </p>
        </AdminOnly>
      </main>
    </div>
  );
}
