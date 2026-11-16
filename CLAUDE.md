# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Roadmap steps 1–4 and 9 are done (setup; source/category CRUD with admin UI; news fetch + card UI; 저장 and /saved; 청약 notices). All PRD tables exist and migrations 0000–0005 are applied to Neon; step 3 was live-checked (real RSS + Claude), step 9 still needs a live data.go.kr check. `src/app/page.tsx` is the news feed (fetch button, category tabs, cards, pagination). Unit tests are Vitest (`src/**/*.test.ts`), E2E is Playwright (`e2e/`, see "E2E" below). `PRD.md` (Korean) is the source of truth for features, data model (section 5), roadmap (section 8) and open questions (section 11). Implement only when the user says so, one roadmap step at a time.

## Commands

- `npm run dev` / `npm run build` / `npm start`
- `npm run lint` (ESLint 9, flat config)
- `npm test` (vitest run); single test: `npx vitest run path/to/file.test.ts -t "name"`
- `npm run test:e2e` (Playwright; run `npx playwright install` once first)
- `npm run db:generate` / `npm run db:migrate` (`drizzle.config.ts` loads `.env.local` itself via `process.loadEnvFile`; shell env wins). Migrations live in `drizzle/`.

## Branches

- `main` is the only long-lived branch; canonical remote is `brief-ai` (`origin` is an old copy, do not push there).
- New work: `step<roadmap number>/<feature>` (e.g. `step5/pwa-push`), one feature per branch/worktree under `.claude/worktrees/` (git-ignored).
- When a feature is done: merge into `main`, then delete the branch and its worktree. When a roadmap step is done, tag `v0.<step>` and update the Status section above.

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
- Saving (migration `0004`, applied to Neon): table `saved_housing_notices` (same shape as `saved_articles`, FK `ON DELETE CASCADE`, UNIQUE NULLS NOT DISTINCT on (notice_id, user_id)). `PUT`/`DELETE /api/housing/saved/[id]` (admin token, id = notice id), queries in `src/lib/housing/saved.ts`, shared card `src/components/housing-notice-card.tsx` (used by `/housing` and `/housing/saved`), and `SaveButton` takes `apiBase` (`/api/housing/saved`). `/housing/saved` shows saved notices including closed ones; linked from the `/housing` header. Live-checked (save, repeat save, 404, 401, unsave).
- `src/lib/housing/`: `applyhome.ts` (api.odcloud.kr client + tolerant field mapper, raw row kept), `classify.ts` (pure keyword rule), `sync.ts` (fetch → upsert → `reclassifyHousingNotices`), `queries.ts`, `status.ts`. Any category/feed mutation calls `reclassifyHousingNotices`.
- Field names in `mapNotice` were written from the public API docs and not yet checked against a live response.
- Routes: `/api/housing/{feeds,categories,fetch}` (admin) and `/api/housing/notices/[id]/ics` (public). Pages: `/housing` (server, Suspense for searchParams/DB because `cacheComponents` is on), `/admin/housing-{feeds,categories}`.
## Implemented (step 3, 뉴스 가져오기 + 카드 UI)

- `POST /api/news/fetch` (admin) → `syncNews` in `src/lib/news/sync.ts`: parse active `sources` in parallel (one failure doesn't stop others), skip stored URLs, cap 40 new per run (newest first), batches of 5 to Claude (10 overflowed max_tokens and got truncated) (`src/lib/news/enrich.ts`, model `NEWS_MODEL` = claude-haiku-5-5, RSS snippet only, Zod-validated). A failed batch is not saved, so it is retried next run. Needs `ANTHROPIC_API_KEY` (503 if unset). Live-checked: 40 saved, 0 failed batches.
- Dedupe (`src/lib/news/dedupe.ts`, tested): URLs are normalised before the stored-URL check, and near-identical titles are dropped so the same story is not sent to Claude twice.
- Home `/` (`src/app/page.tsx`, server, Suspense for searchParams/DB): `fetch-news-button.tsx` calls the fetch API, category tabs use `?category=<id>`, cards show the category (미분류 when null), `ARTICLES_PER_PAGE` = 6 with `src/components/pagination.tsx` (first/prev/numbers/…/next/last; page logic in `src/lib/page-items.ts`). Queries live in `src/lib/news/queries.ts`.
- E2E covers card list, pagination, category filter and save; the fetch button flow (real Claude) is not in E2E.
- Seed sources 1–3 (샘플 …) point to dead URLs and report 404 on every fetch; deactivate or delete them in the admin UI.
- Card photo (`articles.image_url`, migration `0005`): only the URL is stored (https only), never the file; the browser loads it straight from the publisher (`referrerPolicy="no-referrer"`). `src/lib/news/image.ts`: `pickImageUrl` reads the RSS item (media:content → media:thumbnail → enclosure → first `<img>`), and for new articles still without one `fetchOgImage` reads the head of the article page for `og:image` (4 s timeout, 200 KB cap, blocks private/localhost hosts, max 3 redirects, 5 in parallel). Logo/default-looking file names are rejected. `syncNews` also fills the image of already-stored articles that the current RSS shows with one (no Claude call, max 200 per run). Older articles that are no longer in any feed keep no photo. `src/components/card-image.tsx` hides the photo area if the image fails to load.
- Copyright note: PRD section 4 says summary plus link only. Hotlinking the publisher's own RSS/og thumbnail is a product decision beyond that; revisit if it becomes a concern.

## Implemented (step 4, 저장/스크랩)

- `PUT` / `DELETE /api/saved/[id]` (admin token, `id` = article id; idempotent; 404 for unknown article) write `saved_articles` with `user_id` null. Queries in `src/lib/news/saved.ts` (`savedIdSet`, `listSaved`, limit 100).
- `src/components/article-card.tsx` is the shared card (home and `/saved`); `save-button.tsx` is a client toggle using `useOptimistic`, reads the same `admin-token` as the admin pages (`ADMIN_TOKEN_KEY` exported from `admin-api.tsx`) and calls `router.refresh()` after success. `/saved` is a server page (Suspense + `connection()`), linked from the home header (저장함).
- Live-checked against Neon: save adds one row, repeat save is a no-op, unsave removes it, no token → 401. Not done: optional memo (`note` column exists, no UI), pagination on `/saved`.

## Implemented (step 5a, PWA 설치 + 오프라인 안내)

- Branch `step5/pwa-push-cron`. Step 5 is split: **5a PWA (done)**, 5b web push + subscriptions, 5c Resend email, 5d Vercel Cron (news + 청약 auto fetch). Alert rules (PRD section 11 item 4, 17장 하루 최대 2개) are still undecided; keep them configurable via `notification_settings`.
- No Serwist: a hand-written `public/sw.js` (also the place for the future `push` handler) caches only `/offline` and `/_next/static/*`; HTML pages and `/api/*` are never cached, so lists are never stale. Bump `VERSION` in `sw.js` if the cached set changes. `next.config.ts` serves `/sw.js` with `no-cache`.
- `src/app/manifest.ts`; icons are drawn in code (`src/lib/pwa-icon.tsx`, routes `/pwa-icon/{180,192,512}`, `?maskable=1`, plus `apple-icon.tsx`), letter "B" only (no font file). Replace with real artwork when a logo exists.
- `src/components/pwa-client.tsx` (in the root layout) registers the SW in production only and shows a dismissible iOS "홈 화면에 추가" hint. E2E: `e2e/pwa.spec.ts`. Real install and offline behaviour must be checked by hand on a device (HTTPS).

## Implemented (step 5b, 웹푸시 코드)

- Code is done, **not yet live-checked**: the VAPID keys are generated by the user locally (`npx web-push generate-vapid-keys`) and put in `.env.local` as `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:` or `https:`). Never generate or print the private key in a session. Without them `/api/push/test` returns 503. Production (Vercel) needs its own keys.
- `src/lib/push/`: `config.ts` (reads the 3 env vars), `payload.ts` (Zod: `{title, body, url}` with site-internal `url` only; subscription schema rejects non-https, localhost/internal and IP-literal endpoints because the server POSTs to that URL), `send.ts` (`sendToAll`: deletes subscriptions that answer 404/410, counts other failures; `upsertSubscription`/`removeSubscription`). `web-push` v4 is ESM named exports with `@types/web-push` (v3 typings); the VAPID details are passed per call, no global state.
- `POST|DELETE /api/push/subscription` and `POST /api/push/test` (all admin token). `public/sw.js` has the `push` and `notificationclick` handlers (opens only same-origin paths). UI: `/notifications` (home header "알림") with `src/components/push-toggle.tsx` (permission → subscribe → save; rolls back the browser subscription if the server save fails).
- Not yet: who gets which notification and when (rule in `notification_settings`, daily cap of 2). E2E blanks the VAPID env so tests never reach a real push service (`e2e/push.spec.ts`).

## Implemented (step 5d, Vercel Cron 자동 수집)

- `vercel.json` schedules `GET /api/cron/news` (`0 21 * * *` UTC = 06:00 KST) and `GET /api/cron/housing` (`30 21 * * *` = 06:30 KST). The routes reuse `syncNews` / `syncHousing`, the same code as the buttons.
- Auth is `src/lib/cron-auth.ts`: `Authorization: Bearer <CRON_SECRET>` (Vercel sends it when the `CRON_SECRET` env var exists). Separate from `ADMIN_TOKEN`; 503 if unset, so the endpoints stay closed until the secret is set in Vercel project env. Set `CRON_SECRET` there (a long random value) before the first deploy.
- Not live-checked: no deploy yet. Vercel plan limits on cron frequency and `maxDuration` (60 s here) must be checked against the actual plan; daily is the least a plan allows. A news run is capped at 40 new articles, so a once-a-day run keeps up only if fewer than 40 new items appear per day; raise the frequency if the plan allows. Run times are approximate on some plans.
- E2E (`e2e/cron.spec.ts`): 401 without/with wrong secret (admin token does not work), 503 with the right secret because external keys are blank in E2E.

## E2E (Playwright)

- `npm run test:e2e` builds the app and runs it with `next start` on port 3200 (`playwright.config.ts`), then runs `e2e/*.spec.ts` at a 380px mobile viewport, one worker. First time: `npx playwright install chromium`.
- It uses its own Neon branch `e2e-test` (project `brief`), never the production database. The URL lives in the git-ignored `.env.e2e` (`E2E_DATABASE_URL`, `E2E_ADMIN_TOKEN`); the config passes it to the server as `DATABASE_URL`, so `.env.local` is overridden. Create `.env.e2e` in each new worktree (copy it from the main folder).
- `e2e/global-setup.ts` **wipes and reseeds** news/housing tables on that branch before every run (7 articles in 2 categories, 2 housing notices, all prefixed `[E2E]`) and refuses to run if the URL points at the same host as `DATABASE_URL` in `.env.local`. New migrations must be applied to the `e2e-test` branch too (set `DATABASE_URL` to the E2E URL for `npm run db:migrate`), or reset the branch from its parent.
- Claude and data.go.kr are not called (keys are blanked), so fetch buttons are not covered; seed data stands in for fetched rows.

## Implemented (청약 카드 사진, 네이버 API HUB)

- `housing_notices.image_url` (migration `0006`). `NO_IMAGE` (`""`) = searched, nothing suitable (not shown, not searched again); null = not searched yet.
- Env: `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `NAVER_OPEN_API_URL` are **Naver Cloud API HUB** keys (headers `X-NCP-APIGW-API-KEY-ID` / `X-NCP-APIGW-API-KEY`, path `/search/v1/image`), not developers.naver.com keys. Read via `src/lib/naver.ts`.
- `src/lib/housing/image.ts`: after each housing sync, `fillHousingImages` searches up to 40 unsearched notices (open/upcoming first). A result is used only if the title contains the complex name, is not ad-like (`UNWANTED`), is landscape (ratio 1.2–2, width ≥ 500) and either says 조감도/전경 etc. or comes from `TRUSTED_HOSTS` (press/review photos). Thumbnails are upgraded `b150` → `b360` (larger sizes 404). Only the URL is stored. Card uses the shared `CardImage`.
