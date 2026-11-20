import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { HousingNoticeCard } from "@/components/housing-notice-card";
import { getDb, hasDatabaseUrl } from "@/db";
import { listHousingCategories } from "@/lib/housing/queries";
import { listSavedNotices } from "@/lib/housing/saved";
import { todayKst } from "@/lib/housing/status";

export const metadata: Metadata = { title: "저장한 청약 공고" };

async function SavedNotices() {
  if (!hasDatabaseUrl()) {
    return (
      <p role="alert" className="rounded-lg border p-4 text-sm">
        <code>.env.local</code>에 <code>DATABASE_URL</code>을 넣어 주세요.
      </p>
    );
  }
  // "Today" must be computed per request, not baked into the prerender.
  await connection();
  const db = getDb();
  const [notices, categories] = await Promise.all([listSavedNotices(db), listHousingCategories(db)]);
  const today = todayKst();
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  if (notices.length === 0) {
    return (
      <div className="rounded-lg border p-4">
        <p className="mb-1 font-semibold">저장한 공고가 없어요</p>
        <p className="text-sm text-muted-foreground">
          청약 정보의 카드에서 &quot;☆ 저장&quot;을 누르면 여기에 모여요.
        </p>
      </div>
    );
  }
  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">{notices.length}개 저장했어요.</p>
      <ul className="grid gap-3">
        {notices.map((n) => (
          <HousingNoticeCard
            key={n.id}
            notice={n}
            categoryName={(n.categoryId ? categoryName.get(n.categoryId) : undefined) ?? "미분류"}
            today={today}
            saved
            removeOnUnsave
          />
        ))}
      </ul>
    </>
  );
}

export default function SavedHousingPage() {
  return (
    <main className="mx-auto w-full max-w-[560px] px-4 py-6">
      <Link
        href="/housing"
        className="mb-3 inline-flex min-h-11 items-center rounded-md border px-3 text-sm"
      >
        ← 청약 정보
      </Link>
      <h1 className="mb-1 text-xl font-bold">저장한 청약 공고</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        마감된 공고도 저장해 둔 것은 그대로 보여요. 별을 다시 누르면 목록에서 빠져요.
      </p>
      <Suspense fallback={<p className="text-sm">불러오고 있어요…</p>}>
        <SavedNotices />
      </Suspense>
    </main>
  );
}
