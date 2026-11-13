import Link from "next/link";
import { pageItems } from "@/lib/page-items";

/**
 * [처음][이전] 1 … 48 49 [50] 51 52 … 100 [다음][끝].
 * `hrefFor(page)` builds the link for a page number.
 */
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
  const base =
    "inline-flex min-h-11 min-w-9 items-center justify-center rounded-full border px-2.5 text-sm";
  const off = `${base} pointer-events-none opacity-40`;

  const nav = (label: string, target: number, disabled: boolean) =>
    disabled ? (
      <span aria-disabled className={off}>
        {label}
      </span>
    ) : (
      <Link href={hrefFor(target)} className={base}>
        {label}
      </Link>
    );

  return (
    <nav aria-label="페이지" className="mt-5 flex flex-wrap items-center justify-center gap-1">
      {nav("처음", 1, page <= 1)}
      {nav("이전", page - 1, page <= 1)}
      {pageItems(page, totalPages).map((item, i) =>
        item === "gap" ? (
          <span key={`gap-${i}`} aria-hidden className="px-1 text-sm">
            …
          </span>
        ) : item === page ? (
          <span
            key={item}
            aria-current="page"
            className={`${base} border-transparent bg-foreground font-semibold text-background`}
          >
            {item}
          </span>
        ) : (
          <Link key={item} href={hrefFor(item)} className={base}>
            {item}
          </Link>
        ),
      )}
      {nav("다음", page + 1, page >= totalPages)}
      {nav("끝", totalPages, page >= totalPages)}
    </nav>
  );
}
