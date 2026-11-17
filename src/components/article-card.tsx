import { timeAgo, type ArticleCard } from "@/lib/news/queries";
import { CardImage } from "./card-image";
import { ReminderMenu } from "./reminder-menu";
import { SaveButton } from "./save-button";

/** 홈과 저장 페이지가 함께 쓰는 뉴스 카드. */
export function ArticleCardItem({ article: a, saved }: { article: ArticleCard; saved: boolean }) {
  const when = a.publishedAt ?? a.fetchedAt;
  return (
    <li className="rounded-[18px] bg-surface p-5">
      {a.imageUrl && <CardImage src={a.imageUrl} />}
      <p className="text-xs text-sub">
        <span className="font-bold text-brand">{a.categoryName ?? "미분류"}</span>
        {a.sourceName ? ` · ${a.sourceName}` : ""} · {timeAgo(when)}
      </p>
      <h3 className="mt-2 text-[17px] font-bold leading-[1.45]">{a.titleKo}</h3>
      <p className="mt-2 text-[15px] leading-[1.65] text-sub">{a.summaryKo}</p>
      <div className="mt-4 flex flex-wrap items-start gap-2">
        <a
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center rounded-full border border-brand px-4 text-sm font-bold text-brand"
        >
          원문 보기 ↗
        </a>
        <SaveButton articleId={a.id} initialSaved={saved} />
        <ReminderMenu articleId={a.id} />
      </div>
    </li>
  );
}
