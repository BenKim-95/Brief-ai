import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CommentForm, ItemActions } from "@/components/community-forms";
import { ShareButton } from "@/components/share-button";
import { getDb, hasDatabaseUrl } from "@/db";
import { getPost, listComments } from "@/lib/community/queries";
import { timeAgo } from "@/lib/news/queries";
import { idParamSchema } from "@/lib/schemas";
import { readVisitorId } from "@/lib/visitor";

export const metadata = { title: "제보 기사 글 · 브리프" };

async function Detail({ params }: { params: Promise<{ id: string }> }) {
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
  const visitorId = await readVisitorId();
  const post = await getPost(db, parsed.data, visitorId);
  if (!post) notFound();
  const comments = await listComments(db, post.id, visitorId);

  return (
    <>
      <article className="mt-5 rounded-[18px] bg-surface p-5">
        <h1 className="text-[20px] font-bold leading-[1.45]">{post.title}</h1>
        <p className="mt-1 text-xs text-sub">
          {post.authorName} · {timeAgo(post.createdAt)}
        </p>
        {post.articleId && post.articleTitle && (
          <p className="mt-3 rounded-xl bg-app px-3 py-2 text-sm">
            <span className="text-xs text-sub">이야기 중인 소식 </span>
            <Link href={`/articles/${post.articleId}`} className="font-bold text-brand underline">
              {post.articleTitle}
            </Link>
          </p>
        )}
        {/* 글 내용은 글자 그대로만 보여 준다(링크·서식 없음). 줄바꿈은 살린다. */}
        <p className="mt-4 whitespace-pre-wrap break-words text-[15px] leading-[1.75]">{post.body}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <ShareButton path={`/community/${post.id}`} title={post.title} text={post.body} />
          <ItemActions kind="post" id={post.id} mine={post.mine} afterDelete="/community" />
        </div>
      </article>

      <section aria-labelledby="comments" className="mt-6">
        <h2 id="comments" className="mb-3 text-base font-bold">
          댓글 {comments.length}개
        </h2>
        {comments.length === 0 ? (
          <p className="mb-4 text-sm text-sub">아직 댓글이 없어요. 첫 댓글을 남겨 보세요.</p>
        ) : (
          <ul className="mb-5 flex flex-col gap-2">
            {comments.map((c) => (
              <li key={c.id} className="rounded-2xl bg-surface p-4">
                <p className="text-xs text-sub">
                  {c.authorName} · {timeAgo(c.createdAt)}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-[1.65]">{c.body}</p>
                <div className="mt-2">
                  <ItemActions kind="comment" id={c.id} mine={c.mine} />
                </div>
              </li>
            ))}
          </ul>
        )}
        <CommentForm postId={post.id} />
      </section>
    </>
  );
}

export default function CommunityPostPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="flex-1 bg-app">
      <main className="mx-auto w-full max-w-[480px] px-5 pb-16">
        <header className="flex items-center justify-between pt-5">
          <Link
            href="/community"
            className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm text-sub"
          >
            ← 제보 기사
          </Link>
        </header>
        <Suspense fallback={<p className="pt-6 text-sm text-sub">불러오는 중이에요…</p>}>
          <Detail params={params} />
        </Suspense>
      </main>
    </div>
  );
}
