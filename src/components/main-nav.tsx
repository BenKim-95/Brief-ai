import Link from "next/link";

/** 홈과 각 모아보기 화면 위쪽에 놓는 바로가기. 새 화면이 생기면 여기에만 더하면 된다. */
export const MAIN_NAV = [
  { href: "/", label: "뉴스 피드" },
  { href: "/five-minute", label: "5분 이슈" },
  { href: "/for-me", label: "나와 관련된 소식" },
  { href: "/community", label: "제보 기사" },
] as const;

export type MainNavHref = (typeof MAIN_NAV)[number]["href"];

export function MainNav({ current }: { current: MainNavHref }) {
  return (
    <nav aria-label="둘러보기" className="-mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1">
      {MAIN_NAV.map((item) => {
        const active = item.href === current;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-bold ${
              active ? "bg-brand text-primary-foreground" : "border border-line bg-surface text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
