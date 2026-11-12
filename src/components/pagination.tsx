import Link from "next/link";

/** 이전/다음 + "n / total 페이지". `hrefFor(page)` builds the link for a page number. */
export function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  const btn = "inline-flex min-h-11 items-center rounded-full border px-4 text-sm";
  const off = `${btn} pointer-events-none opacity-40`;
  return (
    <nav aria-label="페이지" className="mt-5 flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={btn}>
          ‹ 이전
        </Link>
      ) : (
        <span aria-disabled className={off}>
          ‹ 이전
        </span>
      )}
      <span className="text-sm">
        {page} / {totalPages} 페이지
      </span>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={btn}>
          다음 ›
        </Link>
      ) : (
        <span aria-disabled className={off}>
          다음 ›
        </span>
      )}
    </nav>
  );
}
