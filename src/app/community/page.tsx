import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { MainNav } from "@/components/main-nav";
import { Pagination } from "@/components/pagination";
import { getDb, hasDatabaseUrl } from "@/db";
import { countPosts, listPosts } from "@/lib/community/queries";
import { POSTS_PER_PAGE } from "@/lib/community/rules";
import { timeAgo } from "@/lib/news/queries";
import { readVisitorId } from "@/lib/visitor";

export const metadata = { title: "제보 기사 · 브리프" };

type Search = { [key: string]: string | string[] | undefined };

async function Posts({ searchParams }: { searchParams: Promise<Search> }) {
  if (!hasDatabaseUrl()) {
    return (
      <p role="alert" className="rounded-2xl bg-surface p-5 text-sm text-sub">
        <code>.env.local</code>에 <code>DATABASE_URL</code>을 넣어 주세요.
      </p>
    );
  }
  await connection();
  const sp = await searchParams;
  const db = getDb();
  const rawPage = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const requested = rawPage && /^\d+$/.test(rawPage) ? Math.max(1, Number(rawPage)) : 1;
  const total = await countPosts(db);
  const totalPages = Math.max(1, Math.ceil(total / POSTS_PER_PAGE));
  const page = Math.min(requested, totalPages);
  const posts = await listPosts(db, page, await readVisitorId());

  if (total === 0) {
    return (
      <div className="rounded-2xl bg-surface p-5">
        <p className="mb-1 font-bold">아직 올라온 글이 없어요</p>
        <p className="text-sm text-sub">첫 글을 남겨 보세요. 오늘 본 소식에 대한 생각이나 궁금한 점도 좋아요.</p>
      </div>
    );
  }
  return (
    <>
      <p className="mb-3 text-sm text-sub">글 {total}개</p>
      <ul className="flex flex-col gap-3">
        {posts.map((p) => (
          <li key={p.id}>
            <Link href={`/community/${p.id}`} className="block rounded-[18px] bg-surface p-5">
              <h2 className="text-[16px] font-bold leading-[1.45]">{p.title}</h2>
              <p className="mt-1 line-clamp-2 text-[14px] leading-[1.6] text-sub">{p.body}</p>
              <p className="mt-2 text-xs text-sub">
                {p.authorName} · {timeAgo(p.createdAt)} · 댓글 {p.commentCount}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      <Pagination page={page} totalPages={totalPages} hrefFor={(n) => (n > 1 ? `/community?page=${n}` : "/community")} />
    </>
  );
}

export default function CommunityPage({ searchParams }: PageProps<"/community">) {
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
          <Link
            href="/community/new"
            className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-bold text-primary-foreground"
          >
            글쓰기
          </Link>
        </header>
        <h1 className="mt-5 text-[26px] font-bold leading-[1.35]">제보 기사</h1>
        <p className="mt-1 text-sm text-sub">함께 읽은 소식에 대해 이야기를 나눠요.</p>
        <MainNav current="/community" />
        <div className="mt-4">
          <Suspense fallback={<p className="text-sm text-sub">불러오는 중이에요…</p>}>
            <Posts searchParams={searchParams} />
          </Suspense>
        </div>
        <p className="mt-8 text-xs leading-[1.7] text-sub">
          서로 존중하며 써 주세요. 투자 권유, 정치적 비방, 개인정보가 담긴 글은 신고로 가려질 수 있어요. 글은 로그인 없이 이
          브라우저의 닉네임으로 올라가요.
        </p>
      </main>
    </div>
  );
}
