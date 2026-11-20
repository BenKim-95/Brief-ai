import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { NewPostForm } from "@/components/community-forms";
import { getDb, hasDatabaseUrl } from "@/db";
import { getArticleCard } from "@/lib/news/queries";

export const metadata = { title: "글쓰기 · 브리프" };

async function Form({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.article) ? sp.article[0] : sp.article;
  let articleId: number | undefined;
  let articleTitle: string | undefined;
  if (raw && /^\d+$/.test(raw) && hasDatabaseUrl()) {
    await connection();
    const a = await getArticleCard(getDb(), Number(raw));
    if (a) {
      articleId = a.id;
      articleTitle = a.titleKo;
    }
  }
  return <NewPostForm articleId={articleId} articleTitle={articleTitle} />;
}

export default function NewPostPage({ searchParams }: PageProps<"/community/new">) {
  return (
    <div className="flex-1 bg-app">
      <main className="mx-auto w-full max-w-[480px] px-5 pb-16">
        <header className="flex items-center justify-between pt-5">
          <Link
            href="/community"
            className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm text-sub"
          >
            ← 커뮤니티
          </Link>
        </header>
        <h1 className="mt-5 mb-4 text-[26px] font-bold leading-[1.35]">글쓰기</h1>
        <Suspense fallback={<p className="text-sm text-sub">불러오는 중이에요…</p>}>
          <Form searchParams={searchParams} />
        </Suspense>
        <p className="mt-6 text-xs leading-[1.7] text-sub">
          닉네임은 마이페이지에서 바꿀 수 있어요. 투자 권유, 정치적 비방, 전화번호 같은 개인정보는 쓰지 말아 주세요.
        </p>
      </main>
    </div>
  );
}
