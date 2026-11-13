import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull().unique(),
  language: text("language").notNull().default("en"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});

// --- News (steps 3–5). user_id is nullable text until Clerk (step 8). ---

/** Stored only after Claude has produced the Korean title/summary/category. */
export const articles = pgTable(
  "articles",
  {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id").references(() => sources.id, {
      onDelete: "set null",
    }),
    url: text("url").notNull().unique(),
    titleOrig: text("title_orig").notNull(),
    titleKo: text("title_ko").notNull(),
    summaryKo: text("summary_ko").notNull(),
    /** 카드에 보여줄 대표 이미지 주소 (https만, 파일은 저장하지 않음). null = 사진 없음. */
    imageUrl: text("image_url"),
    /** null = 미분류 (also what a deleted category falls back to). */
    categoryId: integer("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("articles_published_at_idx").on(t.publishedAt),
    index("articles_category_id_idx").on(t.categoryId),
  ],
);

export const savedArticles = pgTable(
  "saved_articles",
  {
    id: serial("id").primaryKey(),
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    userId: text("user_id"),
    note: text("note"),
    savedAt: timestamp("saved_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // NULLS NOT DISTINCT: one save per article even before login (user_id null).
  (t) => [unique("saved_articles_article_user_uq").on(t.articleId, t.userId).nullsNotDistinct()],
);

/** Same shape as `saved_articles`, for 청약 공고. */
export const savedHousingNotices = pgTable(
  "saved_housing_notices",
  {
    id: serial("id").primaryKey(),
    noticeId: integer("notice_id")
      .notNull()
      .references(() => housingNotices.id, { onDelete: "cascade" }),
    userId: text("user_id"),
    note: text("note"),
    savedAt: timestamp("saved_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("saved_housing_notices_notice_user_uq").on(t.noticeId, t.userId).nullsNotDistinct()],
);

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  endpoint: text("endpoint").notNull().unique(),
  /** Web Push keys: { p256dh, auth } */
  keys: jsonb("keys").$type<{ p256dh: string; auth: string }>().notNull(),
  userId: text("user_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const notificationSettings = pgTable("notification_settings", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  /** "push" | "email" (validated with Zod, not a DB enum, so channels can grow). */
  channel: text("channel").notNull(),
  /** Notification rule; shape left open until PRD open questions 4/10 are decided. */
  rule: jsonb("rule").notNull().default({}),
  enabled: boolean("enabled").notNull().default(true),
});

// --- Housing (청약, step 9) ---

/** A 청약홈 open-API operation to pull from (e.g. getAPTLttotPblancDetail). */
export const housingFeeds = pgTable("housing_feeds", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  endpoint: text("endpoint").notNull().unique(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Notices are classified by keyword: the first category (by sort_order) with a
 * keyword contained in "<feed name> <type_label>" wins; none matches → 미분류.
 */
export const housingCategories = pgTable("housing_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  keywords: text("keywords").array().notNull().default([]),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const housingNotices = pgTable("housing_notices", {
  id: serial("id").primaryKey(),
  /** HOUSE_MANAGE_NO-PBLANC_NO from 청약홈 */
  externalId: text("external_id").notNull().unique(),
  feedId: integer("feed_id").references(() => housingFeeds.id, {
    onDelete: "set null",
  }),
  categoryId: integer("category_id").references(() => housingCategories.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  /** House type names from the API (e.g. "APT 민영 분양주택"). */
  typeLabel: text("type_label").notNull().default(""),
  region: text("region"),
  address: text("address"),
  supplyCount: integer("supply_count"),
  announcedOn: date("announced_on", { mode: "string" }),
  receiptStart: date("receipt_start", { mode: "string" }),
  receiptEnd: date("receipt_end", { mode: "string" }),
  winnerOn: date("winner_on", { mode: "string" }),
  detailUrl: text("detail_url"),
  raw: jsonb("raw").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
