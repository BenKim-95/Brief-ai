import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb, hasDatabaseUrl } from "@/db";
import { Pagination } from "@/components/pagination";
import {
  countHousingNotices,
  NOTICES_PER_PAGE,
  type NoticeFilter,
  listHousingCategories,
  listHousingNotices,
  listRegions,
} from "@/lib/housing/queries";
import { noticeStatus, STATUS_LABEL, todayKst, type NoticeStatus } from "@/lib/housing/status";
import { FetchButton } from "./fetch-button";

export const metadata: Metadata = { title: "청약 정보" };

type Search = { [key: string]: string | string[] | undefined };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function hrefWith(current: Search, patch: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  for (const k of ["category", "region", "closed"]) {
    const v = k in patch ? patch[k] : one(current[k]);
    if (v) p.set(k, v);
  }
  // Changing a filter returns to page 1; only an explicit `page` patch keeps paging.
  if (patch.page && patch.page !== "1") p.set("page", patch.page);
  const s = p.toString();
  return s ? `/housing?${s}` : "/housing";
}

const STATUS_STYLE: Record<NoticeStatus, string> = {
  open: "bg-primary text-primary-foreground",
  upcoming: "border",
  closed: "bg-muted text-muted-foreground",
  unknown: "border border-dashed",
};

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm ${
        active ? "bg-foreground text-background" : ""
      }`}
    >
      {children}
    </Link>
  );
}

function formatDate(d: string | null) {
  if (!d) return null;
  const [, m, day] = d.split("-");
  return `${Number(m)}월 ${Number(day)}일`;
}

function SetupNotice({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="rounded-lg border p-4 text-base">
      <p className="mb-2 font-semibold">⚠ 아직 공고를 불러올 수 없어요</p>
      {children}
    </div>
  );
}

async function Notices({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  if (!hasDatabaseUrl()) {
    return (
      <SetupNotice>
        <p className="text-sm">
          <code>.env.local</code>에 <code>DATABASE_URL</code>이 비어 있어요. Neon 연결 문자열을
          넣고 저장한 뒤 마이그레이션을 실행해 주세요.
        </p>
      </SetupNotice>
    );
  }
  const db = getDb();
  // "Today" must be computed per request, not baked into the prerender.
  await connection();
  const today = todayKst();
  const rawCategory = one(sp.category);
  const category: NoticeFilter["category"] =
    rawCategory === "none" ? "none" : rawCategory && /^\d+$/.test(rawCategory) ? Number(rawCategory) : undefined;
  const region = one(sp.region) || undefined;
  const includeClosed = one(sp.closed) === "1";

  const filter: NoticeFilter = { category, region, includeClosed, today };
  const rawPage = one(sp.page);
  const requested = rawPage && /^\d+$/.test(rawPage) ? Math.max(1, Number(rawPage)) : 1;

  let data;
  try {
    const total = await countHousingNotices(db, filter);
    const totalPages = Math.max(1, Math.ceil(total / NOTICES_PER_PAGE));
    const page = Math.min(requested, totalPages);
    data = await Promise.all([
      listHousingCategories(db),
      listRegions(db),
      listHousingNotices(db, filter, page),
      Promise.resolve({ page, totalPages }),
    ]);
  } catch (e) {
    console.error("[housing] failed to load notices", e);
    return (
      <SetupNotice>
        <p className="text-sm">
          DB에서 공고를 읽지 못했어요. 청약 테이블이 없다면 마이그레이션을 실행해 주세요
          (<code>drizzle-kit migrate</code>). 자세한 내용은 서버 로그에 남겼어요.
        </p>
      </SetupNotice>
    );
  }
  const [categories, regions, notices, { page, totalPages }] = data;
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <>
      <nav aria-label="카테고리" className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip href={hrefWith(sp, { category: undefined })} active={category === undefined}>
          전체
        </Chip>
        {categories.map((c) => (
          <Chip key={c.id} href={hrefWith(sp, { category: String(c.id) })} active={category === c.id}>
            {c.name}
          </Chip>
        ))}
        <Chip href={hrefWith(sp, { category: "none" })} active={category === "none"}>
          미분류
        </Chip>
      </nav>

      {regions.length > 0 && (
        <nav aria-label="지역" className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
          <Chip href={hrefWith(sp, { region: undefined })} active={!region}>
            전 지역
          </Chip>
          {regions.map((r) => (
            <Chip key={r} href={hrefWith(sp, { region: r })} active={region === r}>
              {r}
            </Chip>
          ))}
        </nav>
      )}

      <p className="mb-4 text-sm">
        <Link href={hrefWith(sp, { closed: includeClosed ? undefined : "1" })} className="underline">
          {includeClosed ? "마감된 공고 숨기기" : "마감된 공고도 보기"}
        </Link>
      </p>

      {notices.length === 0 ? (
        <p className="rounded-lg border p-4 text-base">
          조건에 맞는 공고가 없어요. 위에서 청약 정보를 가져오거나 필터를 바꿔 보세요.
        </p>
      ) : (
        <ul className="grid gap-3">
          {notices.map((n) => {
            const status = noticeStatus(n.receiptStart, n.receiptEnd, today);
            const receipt =
              n.receiptStart && n.receiptEnd && n.receiptStart !== n.receiptEnd
                ? `${formatDate(n.receiptStart)} ~ ${formatDate(n.receiptEnd)}`
                : formatDate(n.receiptStart ?? n.receiptEnd);
            return (
              <li key={n.id}>
                <article className="rounded-lg border bg-card p-4 text-card-foreground">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full px-2 py-1 font-medium ${STATUS_STYLE[status]}`}>
                      {STATUS_LABEL[status]}
                    </span>
                    <span className="rounded-full border px-2 py-1">
                      {n.categoryId ? categoryName.get(n.categoryId) : "미분류"}
                    </span>
                    {n.region && <span className="text-muted-foreground">{n.region}</span>}
                  </div>
                  <h2 className="text-base font-semibold leading-snug">{n.name}</h2>
                  {n.address && <p className="mt-1 text-sm text-muted-foreground">{n.address}</p>}
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                    {n.typeLabel && (
                      <>
                        <dt className="text-muted-foreground">유형</dt>
                        <dd>{n.typeLabel}</dd>
                      </>
                    )}
                    {n.supplyCount !== null && (
                      <>
                        <dt className="text-muted-foreground">공급</dt>
                        <dd>{n.supplyCount.toLocaleString("ko-KR")}세대</dd>
                      </>
                    )}
                    {n.announcedOn && (
                      <>
                        <dt className="text-muted-foreground">모집공고</dt>
                        <dd>{formatDate(n.announcedOn)}</dd>
                      </>
                    )}
                    {receipt && (
                      <>
                        <dt className="text-muted-foreground">청약 접수</dt>
                        <dd>{receipt}</dd>
                      </>
                    )}
                    {n.winnerOn && (
                      <>
                        <dt className="text-muted-foreground">당첨자 발표</dt>
                        <dd>{formatDate(n.winnerOn)}</dd>
                      </>
                    )}
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {n.detailUrl && (
                      <a
                        href={n.detailUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center rounded-md border px-3 text-sm"
                      >
                        청약홈 공고 보기 ↗
                      </a>
                    )}
                    {(n.receiptStart || n.receiptEnd || n.winnerOn) && (
                      <a
                        href={`/api/housing/notices/${n.id}/ics`}
                        download
                        className="inline-flex min-h-11 items-center rounded-md border px-3 text-sm"
                      >
                        캘린더에 추가
                      </a>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    정확한 자격·일정은 청약홈 공고문을 확인해 주세요.
                  </p>
                </article>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination page={page} totalPages={totalPages} hrefFor={(n) => hrefWith(sp, { page: String(n) })} />
    </>
  );
}

export default function HousingPage({ searchParams }: PageProps<"/housing">) {
  return (
    <main className="mx-auto w-full max-w-[560px] px-4 py-6">
      <Link
        href="/"
        className="mb-3 inline-flex min-h-11 items-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700"
      >
        ← 뉴스로 돌아가기
      </Link>
      <h1 className="mb-1 text-xl font-bold">청약 정보</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        청약홈에 올라온 분양 공고의 일정을 모아 보여드려요.
      </p>
      <FetchButton />
      <Suspense fallback={<p className="text-sm">공고를 불러오고 있어요…</p>}>
        <Notices searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
