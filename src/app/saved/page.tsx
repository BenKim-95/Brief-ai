import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArticleCardItem } from "@/components/article-card";
import { getDb, hasDatabaseUrl } from "@/db";
import { listSaved } from "@/lib/news/saved";
import { readVisitorId } from "@/lib/visitor";

export const metadata = { title: "저장함 · 브리프" };

async function SavedList() {
  if (!hasDatabaseUrl()) {
    return (
      <p role="alert" className="rounded-2xl bg-surface p-5 text-sm text-sub">
        <code>.env.local</code>에 <code>DATABASE_URL</code>을 넣어 주세요.
      </p>
    );
  }
  await connection();
  const items = await listSaved(getDb(), await readVisitorId());

  if (items.length === 0) {
    return (
      <div className="rounded-2xl bg-surface p-5">
        <p className="mb-1 font-bold">저장한 소식이 없어요</p>
        <p className="text-sm text-sub">
          홈의 카드에서 &quot;☆ 저장&quot;을 누르면 여기에 모여요.
        </p>
      </div>
    );
  }
  return (
    <>
      <p className="mb-3 text-sm text-sub">{items.length}개 저장했어요.</p>
      <ul className="flex flex-col gap-3">
        {items.map((a) => (
          <ArticleCardItem key={a.id} article={a} saved removeOnUnsave />
        ))}
      </ul>
    </>
  );
}

export default function SavedPage() {
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
        <h1 className="mt-5 mb-4 text-[26px] font-bold leading-[1.35]">저장함</h1>
        <Suspense fallback={<p className="text-sm text-sub">불러오는 중이에요…</p>}>
          <SavedList />
        </Suspense>
        <p className="mt-8 text-xs text-sub">
          별을 다시 누르면 저장이 풀려요. 풀면 이 목록에서 사라져요.
        </p>
      </main>
    </div>
  );
}
