import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArticleCardItem } from "@/components/article-card";
import { MainNav } from "@/components/main-nav";
import { getDb, hasDatabaseUrl } from "@/db";
import { getFiveMinuteIssues } from "@/lib/news/five-minute";
import { savedIdSet } from "@/lib/news/saved";
import { readVisitorId } from "@/lib/visitor";

export const metadata = { title: "5분 이슈 · 브리프" };

async function Issues() {
  if (!hasDatabaseUrl()) {
    return (
      <p role="alert" className="rounded-2xl bg-surface p-5 text-sm text-sub">
        <code>.env.local</code>에 <code>DATABASE_URL</code>을 넣어 주세요.
      </p>
    );
  }
  await connection();
  const db = getDb();
  const items = await getFiveMinuteIssues(db);
  if (items.length === 0) {
    return (
      <div className="rounded-2xl bg-surface p-5">
        <p className="mb-1 font-bold">아직 고를 소식이 없어요</p>
        <p className="text-sm text-sub">최근 이틀 안에 들어온 소식이 생기면 여기에 골라 드려요.</p>
      </div>
    );
  }
  const savedIds = await savedIdSet(db, items.map((i) => i.article.id), await readVisitorId());
  const anyViews = items.some((i) => i.views > 0);

  return (
    <>
      <p className="mb-3 text-sm text-sub">
        {items.length}개 · 읽는 데 약 5~10분
        {!anyViews && " · 오늘은 아직 본 사람이 적어서 최근 소식 위주로 골랐어요"}
      </p>
      <ol className="flex flex-col gap-3">
        {items.map((it, i) => (
          <li key={it.article.id} className="list-none">
            <div className="mb-1.5 flex items-center gap-2 px-1 text-sm">
              <span
                aria-hidden
                className="grid size-6 place-items-center rounded-full bg-brand text-xs font-bold text-primary-foreground"
              >
                {i + 1}
              </span>
              <span className="font-bold">{it.article.categoryName ?? "기타"}</span>
              {it.views > 0 && <span className="text-sub">· 오늘 {it.views}명이 봤어요</span>}
            </div>
            <ul>
              <ArticleCardItem article={it.article} saved={savedIds.has(it.article.id)} />
            </ul>
          </li>
        ))}
      </ol>
    </>
  );
}

export default function FiveMinutePage() {
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
        <h1 className="mt-5 text-[26px] font-bold leading-[1.35]">5분 이슈</h1>
        <p className="mt-1 text-sm text-sub">
          출퇴근 사이에 가볍게 훑어보세요. 오늘 가장 많이 본 소식을 분야별로 1개씩, 5개만 골랐어요.
        </p>
        <MainNav current="/five-minute" />
        <div className="mt-4">
          <Suspense fallback={<p className="text-sm text-sub">불러오는 중이에요…</p>}>
            <Issues />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
