import Anthropic from "@anthropic-ai/sdk";
import { asc, eq, inArray } from "drizzle-orm";
import Parser from "rss-parser";
import type { getDb } from "@/db";
import { articles, categories, sources } from "@/db/schema";
import { enrichBatch, type RawArticle } from "./enrich";

type Db = ReturnType<typeof getDb>;

const BATCH_SIZE = 10;
/** Per-run cap so one request fits the function time limit; the rest is picked up next run. */
const MAX_NEW_PER_RUN = 40;
const PER_SOURCE_LIMIT = 30;
const SNIPPET_MAX = 400;

const parser = new Parser({ timeout: 10000 });

type Candidate = {
  sourceId: number;
  sourceName: string;
  url: string;
  title: string;
  snippet: string;
  publishedAt: Date | null;
};

export type NewsSyncResult = {
  sources: { id: number; name: string; ok: boolean; items: number; error?: string }[];
  newFound: number;
  inserted: number;
  skippedByCap: number;
  failedBatches: string[];
};

const clean = (s: string | undefined) =>
  (s ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

export async function syncNews(db: Db, client: Anthropic): Promise<NewsSyncResult> {
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
          if (candidates.has(url)) continue;
          const d = it.isoDate ? new Date(it.isoDate) : null;
          candidates.set(url, {
            sourceId: s.id,
            sourceName: s.name,
            url,
            title,
            snippet: clean(it.contentSnippet ?? it.content).slice(0, SNIPPET_MAX),
            publishedAt: d && !Number.isNaN(d.getTime()) ? d : null,
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

  // 2. Dedupe against stored URLs (never re-call Claude for stored articles)
  const urls = [...candidates.keys()];
  const existing = new Set<string>();
  for (let i = 0; i < urls.length; i += 500) {
    const rows = await db
      .select({ url: articles.url })
      .from(articles)
      .where(inArray(articles.url, urls.slice(i, i + 500)));
    rows.forEach((r) => existing.add(r.url));
  }
  const fresh = [...candidates.values()]
    .filter((c) => !existing.has(c.url))
    .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));
  result.newFound = fresh.length;
  const todo = fresh.slice(0, MAX_NEW_PER_RUN);
  result.skippedByCap = fresh.length - todo.length;
  if (todo.length === 0) return result;

  // 3. Claude in batches -> Zod-validated -> save
  const cats = await db.select().from(categories).orderBy(asc(categories.sortOrder));
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
      const rows = enriched.map((e) => {
        const c = chunk[e.key];
        return {
          sourceId: c.sourceId,
          url: c.url,
          titleOrig: c.title,
          titleKo: e.titleKo,
          summaryKo: e.summaryKo,
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
