import type { housingNotices } from "@/db/schema";
import { noticeStatus, STATUS_LABEL, type NoticeStatus } from "@/lib/housing/status";
import { SaveButton } from "./save-button";

export type HousingNotice = typeof housingNotices.$inferSelect;

const STATUS_STYLE: Record<NoticeStatus, string> = {
  open: "bg-primary text-primary-foreground",
  upcoming: "border",
  closed: "bg-muted text-muted-foreground",
  unknown: "border border-dashed",
};

function formatDate(d: string | null) {
  if (!d) return null;
  const [, m, day] = d.split("-");
  return `${Number(m)}월 ${Number(day)}일`;
}

/** /housing 과 /housing/saved 가 함께 쓰는 공고 카드. */
export function HousingNoticeCard({
  notice: n,
  categoryName,
  today,
  saved,
}: {
  notice: HousingNotice;
  categoryName: string;
  today: string;
  saved: boolean;
}) {
  const status = noticeStatus(n.receiptStart, n.receiptEnd, today);
  const receipt =
    n.receiptStart && n.receiptEnd && n.receiptStart !== n.receiptEnd
      ? `${formatDate(n.receiptStart)} ~ ${formatDate(n.receiptEnd)}`
      : formatDate(n.receiptStart ?? n.receiptEnd);
  return (
    <li>
      <article className="rounded-lg border bg-card p-4 text-card-foreground">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full px-2 py-1 font-medium ${STATUS_STYLE[status]}`}>
            {STATUS_LABEL[status]}
          </span>
          <span className="rounded-full border px-2 py-1">{categoryName}</span>
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
        <div className="mt-3 flex flex-wrap items-start gap-2">
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
          <SaveButton articleId={n.id} initialSaved={saved} apiBase="/api/housing/saved" />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          정확한 자격·일정은 청약홈 공고문을 확인해 주세요.
        </p>
      </article>
    </li>
  );
}
