# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Roadmap steps 1–4 and 9 are done (setup; source/category CRUD with admin UI; news fetch + card UI; 저장 and /saved; 청약 notices). All PRD tables exist and migrations 0000–0003 are applied to Neon; step 3 was live-checked (real RSS + Claude), step 9 still needs a live data.go.kr check. `src/app/page.tsx` is the news feed (fetch button, category tabs, cards, pagination). No Playwright E2E specs exist yet; unit tests are Vitest only. `PRD.md` (Korean) is the source of truth for features, data model (section 5), roadmap (section 8) and open questions (section 11). Implement only when the user says so, one roadmap step at a time.

## Commands

- `npm run dev` / `npm run build` / `npm start`
- `npm run lint` (ESLint 9, flat config)
- `npm test` (vitest run); single test: `npx vitest run path/to/file.test.ts -t "name"`
- `npm run test:e2e` (Playwright; run `npx playwright install` once first)
- `npm run db:generate` / `npm run db:migrate` (`drizzle.config.ts` loads `.env.local` itself via `process.loadEnvFile`; shell env wins). Migrations live in `drizzle/`.

## Stack and gotchas

- Next.js 16 (App Router, `src/` dir, alias `@/*`), React 19, Tailwind 4, TypeScript. `AGENTS.md` warns this Next.js version has breaking changes: read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code.
- `tsc --noEmit` reports `Cannot find name 'LayoutProps'` until Next generates route types (`next build`/`next dev`). It is not a real error.
- shadcn/ui is initialised (`components.json`, `src/components/ui`); `cn` comes from the `cn` package via `src/lib/utils.ts`.
- `@types/node` is pinned to ^24 because vitest 5 has a peer conflict with ^20.

## Planned architecture (from PRD)

- Neon Postgres + Drizzle; tables: sources, categories, articles (url UNIQUE), saved_articles, push_subscriptions, notification_settings, housing_notices (step 9, external_id UNIQUE).
- Housing (PRD v0.2, F11): real-estate policy news is just RSS sources + a category (no new code). 청약 notices come from the data.go.kr 청약홈 open API (server-side key), are stored as structured rows, and never go through Claude. No recommendation or price-outlook wording. `user_id` is nullable everywhere so Clerk can be added later (step 8).
- Fetch flow: Route Handler pulls active RSS sources, dedupes by URL, sends only new articles to Claude in batches for Korean title, summary and category, validates the response with Zod, then saves. Never re-call Claude for stored articles.
- Sources, categories and notification settings are DB rows managed through admin UI/API, never hardcoded. Admin APIs need a minimal secret-token guard until login exists.
- Product constraints: show only summary plus original link (no full article text); polite Korean "~해요" copy; no investment or political-judgment wording; mobile-first (about 380px, centred 480–560px max width).

## Implemented (step 2)

- `src/db/schema.ts` defines every PRD table (`articles`, `saved_articles`, `push_subscriptions`, `notification_settings` added in `drizzle/0003_core_tables.sql`, tables only, no feature code yet). `articles.category_id` is `ON DELETE SET NULL` (null = 미분류); `saved_articles` is UNIQUE NULLS NOT DISTINCT on (article_id, user_id); `notification_settings.rule` is open jsonb until the alert rules are decided. `getDb()` in `src/db/index.ts` is lazy, so builds work without `DATABASE_URL`.
- `src/app/api/{sources,categories}` Route Handlers use Zod schemas from `src/lib/schemas.ts` and helpers from `src/lib/api.ts`. Every handler starts with `requireAdmin()` (`x-admin-token` header vs `ADMIN_TOKEN`; 503 if unset). Source create/update validates the RSS via `src/lib/rss.ts` (`rss-parser`).
- `src/app/admin/**` are client pages; the token is typed into the page and kept in `localStorage` (typed once per browser; falls back to old `sessionStorage` value) (`admin-api.tsx`).
## Implemented (step 9, 청약)

- Key: `DATA_GO_KR_SERVICE_KEY` (Decoding key), read only via `getDataGoKrServiceKey()` in `src/lib/data-go-kr.ts` (503 if unset).
- Tables `housing_feeds` (API operations), `housing_categories` (keywords[], sort_order = match priority), `housing_notices`. Defaults are seeded by `drizzle/0002_housing_seed.sql`, not code.
- `src/lib/housing/`: `applyhome.ts` (api.odcloud.kr client + tolerant field mapper, raw row kept), `classify.ts` (pure keyword rule), `sync.ts` (fetch → upsert → `reclassifyHousingNotices`), `queries.ts`, `status.ts`. Any category/feed mutation calls `reclassifyHousingNotices`.
- Field names in `mapNotice` were written from the public API docs and not yet checked against a live response.
- Routes: `/api/housing/{feeds,categories,fetch}` (admin) and `/api/housing/notices/[id]/ics` (public). Pages: `/housing` (server, Suspense for searchParams/DB because `cacheComponents` is on), `/admin/housing-{feeds,categories}`.
## Implemented (step 3, 뉴스 가져오기 + 카드 UI)

- `POST /api/news/fetch` (admin) → `syncNews` in `src/lib/news/sync.ts`: parse active `sources` in parallel (one failure doesn't stop others), skip stored URLs, cap 40 new per run (newest first), batches of 5 to Claude (10 overflowed max_tokens and got truncated) (`src/lib/news/enrich.ts`, model `NEWS_MODEL` = claude-haiku-5-5, RSS snippet only, Zod-validated). A failed batch is not saved, so it is retried next run. Needs `ANTHROPIC_API_KEY` (503 if unset). Live-checked: 40 saved, 0 failed batches.
- Dedupe (`src/lib/news/dedupe.ts`, tested): URLs are normalised before the stored-URL check, and near-identical titles are dropped so the same story is not sent to Claude twice.
- Home `/` (`src/app/page.tsx`, server, Suspense for searchParams/DB): `fetch-news-button.tsx` calls the fetch API, category tabs use `?category=<id>`, cards show the category (미분류 when null), `ARTICLES_PER_PAGE` = 6 with `src/components/pagination.tsx` (first/prev/numbers/…/next/last; page logic in `src/lib/page-items.ts`). Queries live in `src/lib/news/queries.ts`.
- Still to do for PRD section 9: Playwright E2E (fetch → card → category filter → save).
- Seed sources 1–3 (샘플 …) point to dead URLs and report 404 on every fetch; deactivate or delete them in the admin UI.

## Implemented (step 4, 저장/스크랩)

- `PUT` / `DELETE /api/saved/[id]` (admin token, `id` = article id; idempotent; 404 for unknown article) write `saved_articles` with `user_id` null. Queries in `src/lib/news/saved.ts` (`savedIdSet`, `listSaved`, limit 100).
- `src/components/article-card.tsx` is the shared card (home and `/saved`); `save-button.tsx` is a client toggle using `useOptimistic`, reads the same `admin-token` as the admin pages (`ADMIN_TOKEN_KEY` exported from `admin-api.tsx`) and calls `router.refresh()` after success. `/saved` is a server page (Suspense + `connection()`), linked from the home header (저장함).
- Live-checked against Neon: save adds one row, repeat save is a no-op, unsave removes it, no token → 401. Not done: optional memo (`note` column exists, no UI), Playwright E2E, pagination on `/saved`.
