import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export const NEWS_MODEL = "claude-haiku-5-5";

export type RawArticle = {
  key: number; // index within the batch, echoed back by Claude
  title: string;
  snippet: string; // RSS description only, never the full article
  sourceName: string;
};

export type CategoryInfo = { id: number; name: string; description: string };

const resultSchema = z.array(
  z.object({
    key: z.number().int(),
    titleKo: z.string().trim().min(1).max(200),
    summaryKo: z.string().trim().min(1).max(600),
    categoryId: z.number().int().nullable(),
  }),
);
export type Enriched = z.infer<typeof resultSchema>[number];

const SYSTEM = `당신은 뉴스 카드를 만드는 편집 도우미예요. 기사 목록을 받아 각각에 대해 JSON만 돌려주세요.
규칙:
- titleKo: 한국어 제목. 이미 한국어면 그대로 두되 자극적 표현은 담백하게 다듬어요.
- summaryKo: 제공된 제목과 발췌문에 있는 내용만으로 2~3문장 요약. 없는 내용을 추가하지 마세요. "~해요" 체를 써요. 발췌문이 없으면 제목만 풀어서 한 문장으로 써요.
- 투자·매수 권유, 가격 전망, 정치적 가치판단 표현은 쓰지 마세요.
- categoryId: 주어진 카테고리 중 가장 알맞은 id. 맞는 것이 없으면 null.
출력: [{"key":0,"titleKo":"...","summaryKo":"...","categoryId":1}, ...] 형태의 JSON 배열만. 설명이나 코드블록은 쓰지 마세요.`;

function extractJson(text: string): unknown {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end < start) throw new Error("JSON 배열이 없어요.");
  return JSON.parse(text.slice(start, end + 1));
}

/**
 * Translates/summarises/classifies one batch. Throws on API or format errors
 * (caller leaves the batch unsaved so it is retried next time). Items Claude
 * omitted are simply absent from the result.
 */
export async function enrichBatch(
  client: Anthropic,
  articles: RawArticle[],
  categories: CategoryInfo[],
): Promise<Enriched[]> {
  const catText = categories
    .map((c) => `- id ${c.id}: ${c.name}${c.description ? ` (${c.description})` : ""}`)
    .join("\n");
  const body = articles
    .map(
      (a) =>
        `[key ${a.key}] 출처: ${a.sourceName}\n제목: ${a.title}\n발췌: ${a.snippet || "(없음)"}`,
    )
    .join("\n\n");

  const msg = await client.messages.create({
    model: NEWS_MODEL,
    max_tokens: 4096,
    system: [
      { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
    ],
    messages: [
      {
        role: "user",
        content: `카테고리:\n${catText || "(없음)"}\n\n기사:\n${body}`,
      },
    ],
  });
  const text = msg.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("");

  const parsed = resultSchema.parse(extractJson(text));
  const valid = new Set(categories.map((c) => c.id));
  const keys = new Set(articles.map((a) => a.key));
  return parsed
    .filter((r) => keys.has(r.key))
    .map((r) => ({
      ...r,
      categoryId: r.categoryId !== null && valid.has(r.categoryId) ? r.categoryId : null,
    }));
}
