import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb, hasDatabaseUrl } from "@/db";
import { FetchNewsButton } from "./fetch-news-button";
import { AdminOnly } from "@/components/admin-only";
import { Pagination } from "@/components/pagination";
import {
  ARTICLES_PER_PAGE,
  countArticles,
  listArticles,
  listCategories,
} from "@/lib/news/queries";
import { savedIdSet } from "@/lib/news/saved";
import { readVisitorId } from "@/lib/visitor";
import { ArticleCardItem } from "@/components/article-card";

type Search = { [key: string]: string | string[] | undefined };

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function todayLabel() {
  const kst = new Date(Date.now() + 9 * 3_600_000);
  return `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일 ${WEEKDAYS[kst.getUTCDay()]}요일`;
}

function Header() {
  return (
    <header className="flex items-center justify-between gap-3 pt-5">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid size-8 place-items-center rounded-lg bg-brand text-primary-foreground"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
        <div>
          <p className="text-xl font-bold leading-tight">브리프</p>
          <p className="text-xs text-sub">검증하고, 골라주고, 챙겨주는 정보 비서</p>
        </div>
      </div>
      <nav aria-label="바로가기" className="flex gap-2">
        <Link
          href="/saved"
          className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm text-sub"
        >
          저장함
        </Link>
        {/* 알림 설정은 일단 관리자에게만 보인다. 알림 규칙이 정해지면 다시 모두에게 연다. */}
        <AdminOnly>
          <Link
            href="/notifications"
            className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm text-sub"
          >
            알림
          </Link>
          <Link
            href="/admin/sources"
            className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm text-sub"
          >
            설정
          </Link>
        </AdminOnly>
      </nav>
    </header>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div role="alert" className="rounded-2xl bg-surface p-5">
      <p className="mb-1 font-bold">{title}</p>
      <p className="text-sm text-sub">{children}</p>
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm ${
        active
          ? "border-ink bg-ink text-app"
          : "border-line bg-surface text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

async function News({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  if (!hasDatabaseUrl()) {
    return (
      <Notice title="아직 소식을 불러올 수 없어요">
        <code>.env.local</code>에 <code>DATABASE_URL</code>을 넣어 주세요.
      </Notice>
    );
  }
  await connection();
  const db = getDb();
  const raw = Array.isArray(sp.category) ? sp.category[0] : sp.category;
  const categoryId = raw && /^\d+$/.test(raw) ? Number(raw) : undefined;

  const dayAgo = new Date(new Date().getTime() - 24 * 3_600_000);
  const rawPage = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const requested = rawPage && /^\d+$/.test(rawPage) ? Math.max(1, Number(rawPage)) : 1;

  const { total, fresh } = await countArticles(db, { categoryId, since: dayAgo });
  const totalPages = Math.max(1, Math.ceil(total / ARTICLES_PER_PAGE));
  const page = Math.min(requested, totalPages);
  const [items, cats] = await Promise.all([
    listArticles(db, { categoryId, page }),
    listCategories(db, { onlyWithArticles: true }),
  ]);
  const savedIds = await savedIdSet(
    db,
    items.map((a) => a.id),
    await readVisitorId(),
  );
  const pageHref = (n: number) => {
    const p = new URLSearchParams();
    if (categoryId) p.set("category", String(categoryId));
    if (n > 1) p.set("page", String(n));
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };

  return (
    <>
      <section className="pt-5">
        <p className="text-sm text-sub">{todayLabel()}</p>
        <h1 className="mt-1 text-[26px] font-bold leading-[1.35]">
          {total === 0 ? (
            <>아직 볼 소식이<br />없어요</>
          ) : (
            <>
              오늘 새 소식 {fresh}개,
              <br />
              지금까지 {total}개
            </>
          )}
        </h1>
      </section>

      <Link
        href="/housing"
        className="mt-5 flex min-h-14 items-center justify-between rounded-[20px] bg-brand px-5 text-base font-bold text-primary-foreground"
      >
        <span>청약 일정 보러 가기</span>
        <span aria-hidden>›</span>
      </Link>

      <AdminOnly>
        <FetchNewsButton />
      </AdminOnly>

      <nav aria-label="카테고리" className="-mx-5 mt-6 flex gap-2 overflow-x-auto px-5 pb-1">
        <Chip href="/" active={categoryId === undefined}>전체</Chip>
        {cats.map((c) => (
          <Chip key={c.id} href={`/?category=${c.id}`} active={categoryId === c.id}>
            {c.name}
          </Chip>
        ))}
      </nav>

      <h2 className="mt-6 mb-3 text-base font-bold">나와 관련된 소식</h2>
      {total === 0 ? (
        <Notice title="저장된 소식이 없어요">
          관리 화면에서 &quot;뉴스 가져오기&quot;를 실행하면 여기에 카드가 생겨요.
        </Notice>
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

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <div className="flex-1 bg-app">
      <main className="mx-auto w-full max-w-[480px] px-5 pb-16">
        <Header />
        <Suspense fallback={<p className="pt-8 text-sm text-sub">불러오는 중이에요…</p>}>
          <News searchParams={searchParams} />
        </Suspense>
        <p className="mt-8 text-xs text-sub">
          요약은 기사 제목과 발췌문만 근거로 만들어요. 자세한 내용은 원문에서 확인해 주세요.
        </p>
      </main>
    </div>
  );
}
