import { timeAgo, type ArticleCard } from "@/lib/news/queries";
import { CardImage } from "./card-image";
import { InsightBlock } from "./insight-block";
import { OriginalLink } from "./view-tracker";
import { SaveButton } from "./save-button";
import { ShareButton } from "./share-button";

/** 홈과 저장 페이지가 함께 쓰는 뉴스 카드. */
export function ArticleCardItem({
  article: a,
  saved,
  removeOnUnsave = false,
}: {
  article: ArticleCard;
  saved: boolean;
  /** 저장함용: 저장을 풀면 이 카드를 바로 숨긴다. */
  removeOnUnsave?: boolean;
}) {
  const when = a.publishedAt ?? a.fetchedAt;
  return (
    <li className={`rounded-[18px] bg-surface p-5${removeOnUnsave ? " has-[[data-unsaved]]:hidden" : ""}`}>
      {a.imageUrl && <CardImage src={a.imageUrl} />}
      <p className="text-xs text-sub">
        <span className="font-bold text-brand">{a.categoryName ?? "미분류"}</span>
        {a.sourceName ? ` · ${a.sourceName}` : ""} · {timeAgo(when)}
      </p>
      <h3 className="mt-2 text-[17px] font-bold leading-[1.45]">{a.titleKo}</h3>
      <p className="mt-2 text-[15px] leading-[1.65] text-sub">{a.summaryKo}</p>
      <InsightBlock
        oneLine={a.insightOneLine}
        learned={a.insightLearned}
        perspective={a.insightPerspective}
      />
      <div className="mt-4 flex flex-wrap items-start gap-2">
        <OriginalLink
          articleId={a.id}
          href={a.url}
          className="inline-flex min-h-11 items-center rounded-full border border-brand px-4 text-sm font-bold text-brand"
        >
          원문 보기 ↗
        </OriginalLink>
        <SaveButton articleId={a.id} initialSaved={saved} removeOnUnsave={removeOnUnsave} />
        <ShareButton path={`/articles/${a.id}`} title={a.titleKo} text={a.summaryKo} />
      </div>
    </li>
  );
}
