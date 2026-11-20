import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArticleCardItem } from "@/components/article-card";
import { getDb, hasDatabaseUrl } from "@/db";
import { getArticleCard } from "@/lib/news/queries";
import { savedIdSet } from "@/lib/news/saved";
import { readVisitorId } from "@/lib/visitor";
import { idParamSchema } from "@/lib/schemas";

/** 공유한 링크를 메신저가 미리보기로 펼칠 수 있게, 제목·요약·사진을 메타 정보로 내보낸다. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const fallback: Metadata = { title: "기사 · 브리프" };
  const parsed = idParamSchema.safeParse((await params).id);
  if (!parsed.success || !hasDatabaseUrl()) return fallback;
  await connection();
  const article = await getArticleCard(getDb(), parsed.data);
  if (!article) return fallback;
  const description = article.summaryKo.replace(/\s+/g, " ").trim().slice(0, 160);
  return {
    title: `${article.titleKo} · 브리프`,
    description,
    openGraph: {
      type: "article",
      title: article.titleKo,
      description,
      siteName: "브리프",
      locale: "ko_KR",
      ...(article.imageUrl ? { images: [article.imageUrl] } : {}),
    },
    twitter: { card: article.imageUrl ? "summary_large_image" : "summary", title: article.titleKo, description },
  };
}

async function ArticleView({ params }: { params: Promise<{ id: string }> }) {
  const parsed = idParamSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  if (!hasDatabaseUrl()) {
    return (
      <p role="alert" className="rounded-2xl bg-surface p-5 text-sm text-sub">
        <code>.env.local</code>에 <code>DATABASE_URL</code>을 넣어 주세요.
      </p>
    );
  }
  await connection();
  const db = getDb();
  const article = await getArticleCard(db, parsed.data);
  if (!article) notFound();
  const saved = (await savedIdSet(db, [article.id], await readVisitorId())).has(article.id);
  return (
    <ul>
      <ArticleCardItem article={article} saved={saved} />
    </ul>
  );
}

/** 위젯이나 알림에서 바로 열리는 기사 한 건 화면. */
export default function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
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
        <h1 className="mt-5 mb-4 text-[26px] font-bold leading-[1.35]">기사</h1>
        <Suspense fallback={<p className="text-sm text-sub">불러오는 중이에요…</p>}>
          <ArticleView params={params} />
        </Suspense>
      </main>
    </div>
  );
}
