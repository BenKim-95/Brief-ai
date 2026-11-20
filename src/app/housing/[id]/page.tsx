import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PhotoThumb } from "@/components/photo-thumb";
import { ShareButton } from "@/components/share-button";
import { getDb, hasDatabaseUrl } from "@/db";
import { housingNotices } from "@/db/schema";
import { getHousingPhotos, groupByKind, hostOfLink, type PhotoKind } from "@/lib/housing/photos";
import { idParamSchema } from "@/lib/schemas";
import { eq } from "drizzle-orm";

export const metadata = { title: "청약 사진 · 브리프" };

const KIND_HELP: Record<PhotoKind, string> = {
  조감도: "완공 후 모습을 그린 그림이에요.",
  평면도: "세대 안 구조를 그린 도면이에요.",
  배치도: "단지 안 건물 배치를 그린 도면이에요.",
  모델하우스: "견본주택 안을 찍은 사진이에요.",
};

async function Gallery({ params }: { params: Promise<{ id: string }> }) {
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
  const [notice] = await db.select().from(housingNotices).where(eq(housingNotices.id, parsed.data));
  if (!notice) notFound();
  const outcome = await getHousingPhotos(db, notice);
  const groups = outcome.status === "ok" ? groupByKind(outcome.photos) : [];

  return (
    <>
      <h1 className="mt-5 text-[24px] font-bold leading-[1.35]">{notice.name}</h1>
      <p className="mt-1 text-sm text-sub">
        {[notice.region, notice.typeLabel].filter(Boolean).join(" · ")}
      </p>
      <div className="mt-3 flex flex-wrap items-start gap-2">
        {notice.detailUrl && (
          <a
            href={notice.detailUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center rounded-full border border-brand px-4 text-sm font-bold text-brand"
          >
            청약홈 공고 보기 ↗
          </a>
        )}
        <ShareButton path={`/housing/${notice.id}`} title={`${notice.name} 사진`} text={`${notice.name} 조감도·평면도 모아보기`} />
      </div>

      <div className="mt-6 flex flex-col gap-8">
        {outcome.status === "no-key" && (
          <p role="note" className="rounded-2xl bg-surface p-5 text-sm text-sub">
            사진 검색이 아직 연결되지 않았어요. 청약홈 공고문에서 평면도와 단지 배치를 확인해 주세요.
          </p>
        )}
        {outcome.status === "error" && (
          <p role="alert" className="rounded-2xl bg-surface p-5 text-sm text-sub">
            사진을 불러오지 못했어요. 잠시 뒤에 다시 열어 주세요.
          </p>
        )}
        {outcome.status === "ok" && groups.length === 0 && (
          <p role="note" className="rounded-2xl bg-surface p-5 text-sm text-sub">
            이 단지는 아직 알맞은 사진을 찾지 못했어요. 청약홈 공고문에서 평면도와 단지 배치를 확인해 주세요.
          </p>
        )}
        {groups.map((g) => (
          <section key={g.kind} aria-labelledby={`kind-${g.kind}`}>
            <h2 id={`kind-${g.kind}`} className="text-base font-bold">
              {g.kind}
            </h2>
            <p className="mb-2 text-xs text-sub">{KIND_HELP[g.kind]}</p>
            <ul className="grid grid-cols-2 gap-2">
              {g.photos.map((p) => (
                <PhotoThumb key={p.thumb} thumb={p.thumb} link={p.link} title={p.title} source={hostOfLink(p.link)} />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-8 text-xs leading-[1.7] text-sub">
        인터넷에 올라온 사진을 검색해 모은 것이라 실제와 다르거나 예전 자료일 수 있어요. 사진의 저작권은 각 출처에 있고, 우리
        서버에는 저장하지 않아요. 정확한 평면과 공급 조건은 청약홈 공고문을 확인해 주세요.
      </p>
    </>
  );
}

export default function HousingPhotosPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="flex-1 bg-app">
      <main className="mx-auto w-full max-w-[480px] px-5 pb-16">
        <header className="flex items-center justify-between pt-5">
          <Link
            href="/housing"
            className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm text-sub"
          >
            ← 청약 일정
          </Link>
        </header>
        <Suspense fallback={<p className="pt-6 text-sm text-sub">사진을 불러오는 중이에요…</p>}>
          <Gallery params={params} />
        </Suspense>
      </main>
    </div>
  );
}
