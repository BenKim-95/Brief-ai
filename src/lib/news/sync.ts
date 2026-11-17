import Anthropic from "@anthropic-ai/sdk";
import { asc, desc, eq, gte, inArray } from "drizzle-orm";
import Parser from "rss-parser";
import type { getDb } from "@/db";
import { articles, categories, sources } from "@/db/schema";
import { hasSimilarTitle, normalizeUrl } from "./dedupe";
import { classifyTitles, enrichBatch, type RawArticle } from "./enrich";
import { fetchOgImage, pickImageUrl } from "./image";
import { computeHotness, selectHotTopics, type Pooled, type Selectable } from "./select";

type Db = ReturnType<typeof getDb>;

/** 한국어 제목+요약 5개면 출력 한도 안에 안정적으로 들어온다 (10개는 응답이 잘렸음). */
const BATCH_SIZE = 5;
/** Per-run cap so one request fits the function time limit; the rest is picked up next run. */
const MAX_NEW_PER_RUN = 40;
const PER_SOURCE_LIMIT = 30;
const SNIPPET_MAX = 400;
/** 제목 유사도 비교 대상: 최근 며칠간 저장된 기사 */
const DEDUPE_DAYS = 7;
const DEDUPE_MAX_ROWS = 3000;

/** RSS에 이미지가 없는 기사의 og:image 조회를 동시에 몇 개까지 할지. */
const IMAGE_LOOKUP_CONCURRENCY = 5;

const parser = new Parser({
  timeout: 10000,
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail", { keepArray: true }],
    ],
  },
});

type Candidate = {
  sourceId: number;
  sourceName: string;
  url: string;
  title: string;
  snippet: string;
  publishedAt: Date | null;
  imageUrl: string | null;
};

export type NewsSyncResult = {
  sources: { id: number; name: string; ok: boolean; items: number; error?: string }[];
  newFound: number;
  inserted: number;
  skippedByCap: number;
  /** 새 기사가 한 번에 처리할 수보다 많아서 카테고리별 핫 토픽 순으로 골랐는지 */
  selectedByHotTopics: boolean;
  /** URL·제목이 이미 저장된 기사와 같거나 비슷해 건너뛴 수 */
  skippedDuplicates: number;
  failedBatches: string[];
};

const clean = (s: string | undefined) =>
  (s ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

export async function syncNews(
  db: Db,
  client: Anthropic,
  opts: { /** 한 번에 처리할 새 기사 수(기본 40). 테스트에서만 바꾼다. */ maxNew?: number } = {},
): Promise<NewsSyncResult> {
  const activeSources = await db
    .select()
    .from(sources)
    .where(eq(sources.active, true))
    .orderBy(asc(sources.id));

  const result: NewsSyncResult = {
    sources: [],
    newFound: 0,
    inserted: 0,
    skippedByCap: 0,
    selectedByHotTopics: false,
    skippedDuplicates: 0,
    failedBatches: [],
  };

  // 1. Collect (a failing source doesn't stop the others)
  const candidates = new Map<string, Candidate>();
  await Promise.all(
    activeSources.map(async (s) => {
      try {
        const feed = await parser.parseURL(s.url);
        let items = 0;
        for (const it of feed.items.slice(0, PER_SOURCE_LIMIT)) {
          const url = it.link?.trim();
          const title = clean(it.title);
          if (!url || !title || !/^https?:\/\//i.test(url)) continue;
          items++;
          const key = normalizeUrl(url);
          if (candidates.has(key)) continue;
          const d = it.isoDate ? new Date(it.isoDate) : null;
          candidates.set(key, {
            sourceId: s.id,
            sourceName: s.name,
            url,
            title,
            snippet: clean(it.contentSnippet ?? it.content).slice(0, SNIPPET_MAX),
            publishedAt: d && !Number.isNaN(d.getTime()) ? d : null,
            imageUrl: pickImageUrl(it),
          });
        }
        result.sources.push({ id: s.id, name: s.name, ok: true, items });
      } catch (e) {
        result.sources.push({
          id: s.id,
          name: s.name,
          ok: false,
          items: 0,
          error: e instanceof Error ? e.message : "RSS를 읽지 못했어요.",
        });
      }
    }),
  );
  result.sources.sort((a, b) => a.id - b.id);

  // 2. Dedupe: 이미 저장된 기사는 건너뛴다. Claude 에 보내지도, 사진 등을 다시 채우지도, 갱신하지도 않는다.
  //    새 기사만 아래로 내려간다(매시간 자동 수집이라 같은 기사가 계속 다시 들어온다).
  //    - 같은 URL (추적 파라미터 등을 뺀 주소 기준)
  //    - 이미 저장됐거나 이번 수집에서 먼저 나온 기사와 제목이 비슷한 것
  const urls = [...candidates.values()].map((c) => c.url);
  const existingExact = new Set<string>();
  for (let i = 0; i < urls.length; i += 500) {
    const rows = await db
      .select({ url: articles.url })
      .from(articles)
      .where(inArray(articles.url, urls.slice(i, i + 500)));
    for (const r of rows) existingExact.add(r.url);
  }
  const since = new Date(Date.now() - DEDUPE_DAYS * 24 * 60 * 60 * 1000);
  const recent = await db
    .select({ url: articles.url, titleOrig: articles.titleOrig, titleKo: articles.titleKo })
    .from(articles)
    .where(gte(articles.fetchedAt, since))
    .orderBy(desc(articles.fetchedAt))
    .limit(DEDUPE_MAX_ROWS);
  const storedKeys = new Set(recent.map((r) => normalizeUrl(r.url)));
  const storedTitles = recent.flatMap((r) => [r.titleOrig, r.titleKo]);

  const sorted = [...candidates.entries()].sort(
    ([, a], [, b]) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
  );
  const fresh: Candidate[] = [];
  const freshTitles: string[] = [];
  for (const [key, c] of sorted) {
    if (existingExact.has(c.url) || storedKeys.has(key)) continue; // 같은 주소
    if (hasSimilarTitle(c.title, storedTitles) || hasSimilarTitle(c.title, freshTitles)) {
      result.skippedDuplicates++;
      continue;
    }
    fresh.push(c);
    freshTitles.push(c.title);
  }
  result.newFound = fresh.length;
  const cats = await db.select().from(categories).orderBy(asc(categories.sortOrder));

  // 한 번에 처리할 수보다 새 기사가 많으면 "카테고리별 핫 토픽 순"으로 고른다(나머지는 건너뛰고, 다음에 피드에 남아 있으면 가져온다).
  //  - 핫함: 같은 이야기를 다룬 기사(제목이 비슷한 기사)가 많고 매체가 여럿일수록
  //  - 카테고리: 제목만 Claude 에 보여 줘서 나누고, 카테고리마다 돌아가며 채운다
  const cap = opts.maxNew ?? MAX_NEW_PER_RUN;
  let todo = fresh;
  if (fresh.length > cap) {
    const pooled = new Map<Candidate, Pooled>(
      [...candidates.values()].map((c) => [c, { title: c.title, sourceId: c.sourceId }]),
    );
    const pool = [...pooled.values()];
    const classified = await classifyTitles(
      client,
      fresh.map((c, key) => ({ key, title: c.title, sourceName: c.sourceName })),
      cats.map((c) => ({ id: c.id, name: c.name, description: c.description })),
    );
    if (classified.failedBatches > 0) {
      result.failedBatches.push(
        `제목 분류 ${classified.failedBatches}개 묶음이 실패해서, 그 기사들은 미분류로 보고 골랐어요.`,
      );
    }
    const items: Selectable[] = fresh.map((c, i) => {
      const h = computeHotness(pooled.get(c)!, pool);
      return {
        id: i,
        categoryId: classified.byKey.get(i) ?? null,
        sources: h.sources,
        mentions: h.mentions,
        time: c.publishedAt?.getTime() ?? 0,
      };
    });
    const picked = new Set(selectHotTopics(items, cap, cats.map((c) => c.id)));
    todo = fresh.filter((_, i) => picked.has(i)); // 처리 순서는 최신 순 그대로
    result.selectedByHotTopics = true;
  }
  result.skippedByCap = fresh.length - todo.length;
  if (todo.length === 0) return result;

  // RSS에 이미지가 없는 기사는 기사 페이지의 og:image를 찾아본다 (실패해도 사진 없이 저장).
  const needImage = todo.filter((c) => !c.imageUrl);
  for (let i = 0; i < needImage.length; i += IMAGE_LOOKUP_CONCURRENCY) {
    await Promise.all(
      needImage.slice(i, i + IMAGE_LOOKUP_CONCURRENCY).map(async (c) => {
        c.imageUrl = await fetchOgImage(c.url);
      }),
    );
  }

  // 3. Claude in batches -> Zod-validated -> save
  // 번역된 한국어 제목끼리도 비교 (영어 기사와 한국어 기사가 같은 내용일 때)
  const acceptedKo = [...storedTitles];
  for (let i = 0; i < todo.length; i += BATCH_SIZE) {
    const chunk = todo.slice(i, i + BATCH_SIZE);
    const raw: RawArticle[] = chunk.map((c, key) => ({
      key,
      title: c.title,
      snippet: c.snippet,
      sourceName: c.sourceName,
    }));
    try {
      const enriched = await enrichBatch(client, raw, cats);
      if (enriched.length === 0) continue;
      const kept = enriched.filter((e) => {
        if (hasSimilarTitle(e.titleKo, acceptedKo)) {
          result.skippedDuplicates++;
          return false;
        }
        acceptedKo.push(e.titleKo);
        return true;
      });
      if (kept.length === 0) continue;
      const rows = kept.map((e) => {
        const c = chunk[e.key];
        return {
          sourceId: c.sourceId,
          url: c.url,
          titleOrig: c.title,
          titleKo: e.titleKo,
          summaryKo: e.summaryKo,
          imageUrl: c.imageUrl,
          categoryId: e.categoryId,
          publishedAt: c.publishedAt,
        };
      });
      const saved = await db
        .insert(articles)
        .values(rows)
        .onConflictDoNothing()
        .returning({ id: articles.id });
      result.inserted += saved.length;
    } catch (e) {
      result.failedBatches.push(
        `${i / BATCH_SIZE + 1}번째 묶음: ${e instanceof Error ? e.message : "처리 실패"}`,
      );
    }
  }
  return result;
}
