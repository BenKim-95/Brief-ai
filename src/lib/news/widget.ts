import { z } from "zod";
import type { ArticleCard } from "./queries";

export const WIDGET_MAX_ITEMS = 5;
export const WIDGET_DEFAULT_ITEMS = 3;
const SUMMARY_MAX = 80;

/** 위젯은 좁은 화면이라 요약을 짧게 줄인다. */
export function shorten(text: string, max = SUMMARY_MAX): string {
  const t = text.replace(/\s+/g, " ").trim();
  const chars = Array.from(t);
  return chars.length <= max ? t : `${chars.slice(0, max - 1).join("").trimEnd()}…`;
}

export const widgetQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(WIDGET_MAX_ITEMS).default(WIDGET_DEFAULT_ITEMS),
});

export type WidgetItem = {
  id: number;
  title: string;
  summary: string;
  category: string | null;
  source: string | null;
  /** ISO 8601 (없으면 수집 시각) */
  publishedAt: string;
  /** 앱 안에서 이 기사를 여는 경로(원문 주소가 아니다) */
  path: string;
};

export function toWidgetItem(a: ArticleCard): WidgetItem {
  return {
    id: a.id,
    title: a.titleKo,
    summary: shorten(a.summaryKo),
    category: a.categoryName,
    source: a.sourceName,
    publishedAt: (a.publishedAt ?? a.fetchedAt).toISOString(),
    path: `/articles/${a.id}`,
  };
}
