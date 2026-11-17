import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex-1 bg-app">
      <main className="mx-auto w-full max-w-[480px] px-5 py-16">
        <h1 className="mb-3 text-[26px] font-bold leading-[1.35]">찾을 수 없어요</h1>
        <p className="mb-6 text-sm text-sub">주소가 바뀌었거나 지워진 소식일 수 있어요.</p>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm text-sub"
        >
          ← 홈으로
        </Link>
      </main>
    </div>
  );
}
