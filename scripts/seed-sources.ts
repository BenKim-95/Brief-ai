// Real news sources. Safe to re-run (url is UNIQUE). Run: npx tsx scripts/seed-sources.ts
import Parser from "rss-parser";
import { getDb } from "../src/db";
import { sources } from "../src/db/schema";

try {
  process.loadEnvFile(".env.local");
} catch {}

const feeds = [
  { name: "연합뉴스", url: "https://www.yna.co.kr/rss/news.xml" },
  { name: "조선일보", url: "https://www.chosun.com/arc/outboundfeeds/rss/?outputType=xml" },
  { name: "경향신문", url: "https://www.khan.co.kr/rss/rssdata/total_news.xml" },
  { name: "매일신문", url: "https://www.imaeil.com/rss" },
];

async function main() {
  const parser = new Parser({ timeout: 15000 });
  for (const f of feeds) {
    try {
      const feed = await parser.parseURL(f.url);
      console.log(`OK   ${f.name}: ${feed.items.length} items`);
    } catch (e) {
      console.warn(`WARN ${f.name}: ${(e as Error).message}`);
    }
  }
  await getDb()
    .insert(sources)
    .values(feeds.map((f) => ({ ...f, language: "ko", active: true })))
    .onConflictDoNothing();
  console.log("sources saved");
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
