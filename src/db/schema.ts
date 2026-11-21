import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  smallint,
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
    /** Claude가 제목·요약만 보고 만든 한 줄 해설 3가지. null = 아직 안 만들었어요(기존 기사). */
    insightOneLine: text("insight_one_line"),
    insightLearned: text("insight_learned"),
    insightPerspective: text("insight_perspective"),
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

/**
 * 방문자(브라우저)별 프로필. 로그인 전까지는 쿠키의 방문자 번호(`v:<uuid>`)가 키다.
 * 닉네임은 커뮤니티에, 관심 카테고리는 "나와 관련된 소식"에 쓴다.
 */
export const visitorProfiles = pgTable("visitor_profiles", {
  visitorId: text("visitor_id").primaryKey(),
  nickname: text("nickname").notNull().default(""),
  interestCategoryIds: integer("interest_category_ids").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * 5분 이슈용 조회 기록. 한 방문자가 같은 기사를 하루에 몇 번 열어도 1회로 센다.
 * day는 한국 시간 기준 날짜. 30일이 지난 기록은 정리한다.
 */
export const articleViews = pgTable(
  "article_views",
  {
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    visitorId: text("visitor_id").notNull(),
    day: date("day", { mode: "string" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.articleId, t.visitorId, t.day] }), index("article_views_day_idx").on(t.day)],
);

// --- 커뮤니티 (사용자가 직접 글을 쓰고 댓글을 주고받는 곳). 글쓴이는 방문자 번호(`v:<uuid>`)로 구분한다. ---

export const communityPosts = pgTable(
  "community_posts",
  {
    id: serial("id").primaryKey(),
    visitorId: text("visitor_id").notNull(),
    /** 쓸 때의 닉네임. 나중에 닉네임을 바꿔도 이미 쓴 글의 이름은 그대로다. */
    authorName: text("author_name").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    /** 특정 뉴스 기사에 대한 이야기라면 그 기사(기사가 지워지면 연결만 사라진다). */
    articleId: integer("article_id").references(() => articles.id, { onDelete: "set null" }),
    /** 신고가 쌓이면 true: 목록·상세에서 가려지고 관리자만 되살리거나 지울 수 있다. */
    hidden: boolean("hidden").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("community_posts_created_idx").on(t.createdAt), index("community_posts_visitor_idx").on(t.visitorId)],
);

export const communityComments = pgTable(
  "community_comments",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
      .notNull()
      .references(() => communityPosts.id, { onDelete: "cascade" }),
    visitorId: text("visitor_id").notNull(),
    authorName: text("author_name").notNull(),
    body: text("body").notNull(),
    hidden: boolean("hidden").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("community_comments_post_idx").on(t.postId), index("community_comments_visitor_idx").on(t.visitorId)],
);

/** 신고. 같은 방문자가 같은 글·댓글을 여러 번 신고해도 1건으로 센다. */
export const communityReports = pgTable(
  "community_reports",
  {
    kind: text("kind").notNull(), // "post" | "comment"
    targetId: integer("target_id").notNull(),
    visitorId: text("visitor_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.kind, t.targetId, t.visitorId] })],
);

/**
 * 배포 후 웹·앱·서버에서 난 오류. 같은 원인은 오류 코드(E-WEB-xxxxx 등) 하나로 합쳐 횟수를 센다.
 * 주소의 쿼리, IP, 쿠키는 저장하지 않는다. 보고 방법은 src/lib/errors/ 참고.
 */
export const errorEvents = pgTable(
  "error_events",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(),
    /** "web" | "app" | "server" */
    source: text("source").notNull(),
    message: text("message").notNull(),
    stack: text("stack"),
    path: text("path"),
    userAgent: text("user_agent"),
    count: integer("count").notNull().default(1),
    /** "open" | "resolved" | "ignored" */
    status: text("status").notNull().default("open"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [index("error_events_last_seen_idx").on(t.lastSeenAt)],
);

/**
 * 사이트 방문 기록(화면을 열 때마다 1건). 하루 방문자수·페이지뷰·시간대·인기 화면을 세는 데 쓴다.
 * day/hour 는 한국 시간 기준. 방문자는 익명 쿠키 번호(`v:<uuid>`)로만 구분하고 IP·주소의 쿼리는 저장하지 않는다.
 * 관리 화면(/admin)과 봇은 세지 않는다. 90일이 지난 기록은 뉴스 크론이 정리한다.
 */
export const siteVisits = pgTable(
  "site_visits",
  {
    id: serial("id").primaryKey(),
    day: date("day", { mode: "string" }).notNull(),
    hour: smallint("hour").notNull(),
    visitorId: text("visitor_id").notNull(),
    /** 숫자 구간은 :id 로 합친 화면 경로 (예: /articles/:id) */
    path: text("path").notNull(),
    /** "web" | "app" */
    source: text("source").notNull().default("web"),
  },
  (t) => [index("site_visits_day_idx").on(t.day)],
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

/** 이메일 알림을 받을 주소(Resend). 로그인 도입 전이라 user_id는 비워 둔다. */
export const emailSubscribers = pgTable("email_subscribers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  /** 수신 해제 링크에 쓰는 무작위 값. 메일을 받은 사람만 알 수 있다. */
  unsubscribeToken: text("unsubscribe_token").notNull().unique(),
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
  /** 네이버 이미지 검색 썸네일 주소(https). 파일은 저장하지 않는다. */
  imageUrl: text("image_url"),
  /**
   * 조감도·평면도 등 사진 모음(네이버 이미지 검색 결과, 주소만 저장). null = 아직 안 찾아봤어요.
   * 모양은 src/lib/housing/photos.ts 의 HousingPhotos 와 같다.
   */
  photos: jsonb("photos").$type<{
    checkedAt: string;
    items: { kind: "조감도" | "평면도" | "배치도" | "모델하우스"; thumb: string; link: string; title: string }[];
  } | null>(),
  raw: jsonb("raw").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
