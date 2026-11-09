import Parser from "rss-parser";

const parser = new Parser({ timeout: 8000 });

export type FeedCheck =
  | { ok: true; title?: string; itemCount: number }
  | { ok: false; error: string };

/** Checks that the URL can be fetched and parsed as an RSS/Atom feed. */
export async function checkFeed(url: string): Promise<FeedCheck> {
  try {
    const feed = await parser.parseURL(url);
    return { ok: true, title: feed.title, itemCount: feed.items.length };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "RSS를 읽지 못했어요.",
    };
  }
}
