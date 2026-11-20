import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArticleCardItem } from "@/components/article-card";
import { MainNav } from "@/components/main-nav";
import { Pagination } from "@/components/pagination";
import { getDb, hasDatabaseUrl } from "@/db";
import { getInterests } from "@/lib/news/for-me";
import { ARTICLES_PER_PAGE, countArticles, listArticles, listCategories } from "@/lib/news/queries";
import { savedIdSet } from "@/lib/news/saved";
import { readVisitorId } from "@/lib/visitor";

export const metadata = { title: "나와 관련된 소식 · 브리프" };

type Search = { [key: string]: string | string[] | undefined };

function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface p-5">
      <p className="mb-1 font-bold">{title}</p>
      <p className="text-sm text-sub">{children}</p>
      <Link
        href="/my"
        className="mt-4 inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-bold text-primary-foreground"
      >
        관심 카테고리 고르러 가기
      </Link>
    </div>
  );
}

async function ForMe({ searchParams }: { searchParams: Promise<Search> }) {
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
  const visitorId = await readVisitorId();
  const interests = await getInterests(db, visitorId);

  if (interests.all.length === 0) {
    return (
      <Empty title="아직 관심 카테고리가 없어요">
        마이페이지에서 관심 있는 카테고리를 고르면, 그 분야의 소식을 여기에 모아 보여 드려요. 소식을 저장하면
        저장한 소식과 같은 분야도 함께 보여요.
      </Empty>
    );
  }

  const rawPage = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const requested = rawPage && /^\d+$/.test(rawPage) ? Math.max(1, Number(rawPage)) : 1;
  const dayAgo = new Date(new Date().getTime() - 24 * 3_600_000);
  const { total, fresh } = await countArticles(db, { categoryIds: interests.all, since: dayAgo });
  const totalPages = Math.max(1, Math.ceil(total / ARTICLES_PER_PAGE));
  const page = Math.min(requested, totalPages);
  const [items, cats] = await Promise.all([
    listArticles(db, { categoryIds: interests.all, page }),
    listCategories(db),
  ]);
  const savedIds = await savedIdSet(db, items.map((a) => a.id), visitorId);
  const names = new Map(cats.map((c) => [c.id, c.name]));
  const label = (ids: number[]) => ids.map((id) => names.get(id)).filter(Boolean).join(" · ");
  const pageHref = (n: number) => (n > 1 ? `/for-me?page=${n}` : "/for-me");

  return (
    <>
      <p className="text-sm text-sub">
        {interests.chosen.length > 0 && <>관심 카테고리: {label(interests.chosen)}</>}
        {interests.chosen.length > 0 && interests.fromSaved.length > 0 && <br />}
        {interests.fromSaved.length > 0 && <>저장한 소식과 같은 분야: {label(interests.fromSaved)}</>}
      </p>
      <h2 className="mt-3 mb-3 text-base font-bold">
        오늘 새 소식 {fresh}개, 지금까지 {total}개
      </h2>
      {total === 0 ? (
        <div className="rounded-2xl bg-surface p-5 text-sm text-sub">
          고른 카테고리에는 아직 소식이 없어요. 새 소식이 들어오면 여기에 보여요.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((a) => (
            <ArticleCardItem key={a.id} article={a} saved={savedIds.has(a.id)} />
          ))}
        </ul>
      )}
      <Pagination page={page} totalPages={totalPages} hrefFor={pageHref} />
    </>
  );
}

export default function ForMePage({ searchParams }: PageProps<"/for-me">) {
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
            href="/my"
            className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm text-sub"
          >
            관심 카테고리 바꾸기
          </Link>
        </header>
        <h1 className="mt-5 text-[26px] font-bold leading-[1.35]">나와 관련된 소식</h1>
        <MainNav current="/for-me" />
        <div className="mt-4">
          <Suspense fallback={<p className="text-sm text-sub">불러오는 중이에요…</p>}>
            <ForMe searchParams={searchParams} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
