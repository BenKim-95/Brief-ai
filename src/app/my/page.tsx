import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ProfileForm } from "@/components/profile-form";
import { getDb, hasDatabaseUrl } from "@/db";
import { countMine, defaultNickname, getProfile } from "@/lib/my/profile";
import { listCategories } from "@/lib/news/queries";
import { readVisitorId } from "@/lib/visitor";

export const metadata = { title: "마이페이지 · 브리프" };

function Row({ href, label, count }: { href: string; label: string; count: number }) {
  return (
    <Link
      href={href}
      className="flex min-h-14 items-center justify-between rounded-2xl bg-surface px-5 text-[15px]"
    >
      <span>{label}</span>
      <span className="flex items-center gap-2 text-sub">
        <b className="text-ink">{count}</b>개<span aria-hidden>›</span>
      </span>
    </Link>
  );
}

async function MyContent() {
  if (!hasDatabaseUrl()) {
    return (
      <p role="alert" className="rounded-2xl bg-surface p-5 text-sm text-sub">
        <code>.env.local</code>에 <code>DATABASE_URL</code>을 넣어 주세요.
      </p>
    );
  }
  await connection();
  const db = getDb();
  const visitorId = await readVisitorId();
  const [profile, counts, cats] = await Promise.all([
    getProfile(db, visitorId),
    countMine(db, visitorId),
    listCategories(db, { onlyWithArticles: true }),
  ]);
  // 아직 방문자 번호가 없는(처음 온) 사람에게 보여 줄 기본 이름은 저장하면 정해진다.
  const placeholderName = visitorId ? defaultNickname(visitorId) : "익명";

  return (
    <>
      <section aria-labelledby="my-activity" className="mb-8">
        <h2 id="my-activity" className="mb-3 text-base font-bold">
          내 활동
        </h2>
        <div className="flex flex-col gap-2">
          <Row href="/saved" label="저장한 소식" count={counts.savedArticles} />
          <Row href="/housing/saved" label="저장한 청약 공고" count={counts.savedNotices} />
        </div>
      </section>

      <section aria-labelledby="my-profile" className="mb-8">
        <h2 id="my-profile" className="mb-3 text-base font-bold">
          내 정보
        </h2>
        <ProfileForm
          key={`${profile.nickname}|${profile.interestCategoryIds.join(",")}`}
          initialNickname={profile.nickname}
          initialInterestIds={profile.interestCategoryIds}
          categories={cats}
          placeholderName={placeholderName}
        />
      </section>

      <p className="rounded-2xl bg-surface p-4 text-xs leading-[1.7] text-sub">
        로그인 없이 이 브라우저에만 저장돼요. 브라우저의 사이트 데이터(쿠키)를 지우거나 다른 기기에서 열면 새 사용자로 보여요.
        로그인 기능이 생기면 계정으로 옮길 수 있게 준비하고 있어요.
      </p>
    </>
  );
}

export default function MyPage() {
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
        <h1 className="mt-5 mb-5 text-[26px] font-bold leading-[1.35]">마이페이지</h1>
        <Suspense fallback={<p className="text-sm text-sub">불러오는 중이에요…</p>}>
          <MyContent />
        </Suspense>
      </main>
    </div>
  );
}
