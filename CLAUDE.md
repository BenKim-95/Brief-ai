# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Roadmap steps 1–7 and 9 are done in code (setup; source/category CRUD with admin UI; news fetch + card UI; 저장 and /saved; PWA, web push, Resend email, Vercel Cron; news `.ics` reminders; Capacitor Android app + widget; 청약 notices), tagged `v0.7` (`v0.6` = through step 6, `v0.5` = through step 5). **Step 7's Android code has never been compiled or run** (no JDK/SDK on the dev PC); only its server side is tested. Migrations 0000–0007 are applied to both the production Neon DB and the `e2e-test` branch. Step 3 was live-checked (real RSS + Claude). Live-checked in 5: web push test notification on localhost with a production build (2026-11-17, desktop browser). Still unchecked live: step 9 (data.go.kr), step 6 (importing the `.ics` into a real calendar app), and in step 5 the real Resend mail, push on a phone / from the deployed origin, the daily digest, and Vercel Cron after deploy. Remaining roadmap: 8 (Clerk). Still open in step 7: build and try the Android app/widget on a device or emulator once the site is deployed (set `CAP_SERVER_URL`), and the iOS widget (needs a Mac). `src/app/page.tsx` is the news feed (fetch button, category tabs, cards, pagination). Unit tests are Vitest (`src/**/*.test.ts`), E2E is Playwright (`e2e/`, see "E2E" below). `PRD.md` (Korean) is the source of truth for features, data model (section 5), roadmap (section 8) and open questions (section 11). Implement only when the user says so, one roadmap step at a time.

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
- `src/lib/housing/`: `applyhome.ts` (api.odcloud.kr client + tolerant field mapper, raw row kept), `classify.ts` (pure keyword rule), `sync.ts` (fetch → insert only new notices → `reclassifyHousingNotices`), `queries.ts`, `status.ts`. Any category/feed mutation calls `reclassifyHousingNotices`.
- Field names in `mapNotice` were written from the public API docs and not yet checked against a live response.
- Routes: `/api/housing/{feeds,categories,fetch}` (admin) and `/api/housing/notices/[id]/ics` (public). Pages: `/housing` (server, Suspense for searchParams/DB because `cacheComponents` is on), `/admin/housing-{feeds,categories}`.
## Implemented (step 3, 뉴스 가져오기 + 카드 UI)

- `POST /api/news/fetch` (admin) → `syncNews` in `src/lib/news/sync.ts`: parse active `sources` in parallel (one failure doesn't stop others), skip stored URLs, cap 40 new per run (newest first), batches of 5 to Claude (10 overflowed max_tokens and got truncated) (`src/lib/news/enrich.ts`, model `NEWS_MODEL` = claude-haiku-5-5, RSS snippet only, Zod-validated). A failed batch is not saved, so it is retried next run. Needs `ANTHROPIC_API_KEY` (503 if unset). Live-checked: 40 saved, 0 failed batches.
- Dedupe (`src/lib/news/dedupe.ts`, tested): URLs are normalised before the stored-URL check, and near-identical titles are dropped so the same story is not sent to Claude twice.
- Home `/` (`src/app/page.tsx`, server, Suspense for searchParams/DB): `fetch-news-button.tsx` calls the fetch API, category tabs use `?category=<id>`, cards show the category (미분류 when null), `ARTICLES_PER_PAGE` = 6 with `src/components/pagination.tsx` (first/prev/numbers/…/next/last; page logic in `src/lib/page-items.ts`). Queries live in `src/lib/news/queries.ts`.
- E2E covers card list, pagination, category filter and save; the fetch button flow (real Claude) is not in E2E.
- Seed sources 1–3 (샘플 …) point to dead URLs and report 404 on every fetch; deactivate or delete them in the admin UI.
- Card photo (`articles.image_url`, migration `0005`): only the URL is stored (https only), never the file; the browser loads it straight from the publisher (`referrerPolicy="no-referrer"`). `src/lib/news/image.ts`: `pickImageUrl` reads the RSS item (media:content → media:thumbnail → enclosure → first `<img>`), and for new articles still without one `fetchOgImage` reads the head of the article page for `og:image` (4 s timeout, 200 KB cap, blocks private/localhost hosts, max 3 redirects, 5 in parallel). Logo/default-looking file names are rejected. Already-stored articles are never touched again (no later photo backfill; see "자동 수집" below), so an article saved without a photo keeps none. `src/components/card-image.tsx` hides the photo area if the image fails to load.
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

- Code is done; the test notification was **live-checked on localhost** (production build, 2026-11-17; not yet on a phone or the deployed origin; subscriptions are per origin, so turn notifications on again after deploying). Note: `next dev` never registers the service worker, so test push with `npm run build && npm start`. The VAPID keys are generated by the user locally (`npx web-push generate-vapid-keys`) and put in `.env.local` as `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:` or `https:`). Never generate or print the private key in a session. Without them `/api/push/test` returns 503. Production (Vercel) needs its own keys.
- `src/lib/push/`: `config.ts` (reads the 3 env vars), `payload.ts` (Zod: `{title, body, url}` with site-internal `url` only; subscription schema rejects non-https, localhost/internal and IP-literal endpoints because the server POSTs to that URL), `send.ts` (`sendToAll`: deletes subscriptions that answer 404/410, counts other failures; `upsertSubscription`/`removeSubscription`). `web-push` v4 is ESM named exports with `@types/web-push` (v3 typings); the VAPID details are passed per call, no global state.
- `POST|DELETE /api/push/subscription` and `POST /api/push/test` (all admin token). `public/sw.js` has the `push` and `notificationclick` handlers (opens only same-origin paths). UI: `/notifications` (home header "알림") with `src/components/push-toggle.tsx` (permission → subscribe → save; rolls back the browser subscription if the server save fails).
- Not yet: who gets which notification and when (rule in `notification_settings`, daily cap of 2). E2E blanks the VAPID env so tests never reach a real push service (`e2e/push.spec.ts`).

## Implemented (step 5d, Vercel Cron 자동 수집)

- `vercel.json` schedules `GET /api/cron/news` (hourly, `0 * * * *`) and `GET /api/cron/housing` (daily, `30 21 * * *` UTC = 06:30 KST); see "자동 수집" below. The routes reuse `syncNews` / `syncHousing`, the same code as the buttons.
- Auth is `src/lib/cron-auth.ts`: `Authorization: Bearer <CRON_SECRET>` (Vercel sends it when the `CRON_SECRET` env var exists). Separate from `ADMIN_TOKEN`; 503 if unset, so the endpoints stay closed until the secret is set in Vercel project env. Set `CRON_SECRET` there (a long random value) before the first deploy.
- Not live-checked: no deploy yet. Vercel plan limits on cron frequency and `maxDuration` (60 s here) must be checked against the actual plan; daily is the least a plan allows. A news run is capped at 40 new articles, so a once-a-day run keeps up only if fewer than 40 new items appear per day; raise the frequency if the plan allows. Run times are approximate on some plans.
- E2E (`e2e/cron.spec.ts`): 401 without/with wrong secret (admin token does not work), 503 with the right secret because external keys are blank in E2E.

## Implemented (step 5, 하루 1회 요약 알림)

- `GET /api/cron/digest` (`0 22 * * *` UTC = 07:00 KST, after the 06:00/06:30 collection crons; `CRON_SECRET` auth, 503 without VAPID keys) → `sendDigest` in `src/lib/push/digest.ts`. One push per day at most (PRD 17장), only when there are new items: counts articles and housing notices whose `fetched_at` is after the last digest, body is counts + latest headline (facts only, no recommendation wording).
- The rule lives in `notification_settings` (channel `push`, `user_id` null; created on first send). `rule` = `{kind:"daily_digest", categoryIds: number[]|null, includeHousing, lastDigestAt}`, parsed by `parseRule` (broken/empty → defaults). `enabled=false` turns it off. `lastDigestAt` only moves forward when at least one device got it, so a total failure is retried next run; the look-back is capped at 48 h.
- No UI or API edits the rule yet (change the row directly); PRD open questions 4/10 (which categories, 청약 알림 기준) stay open. Email (5c, Resend) is not started.
- Verified against the `e2e-test` branch with a stubbed sender (`e2e/digest.spec.ts`); a real push to a real device is still unchecked.

## Implemented (step 5c, Resend 이메일)

- Env (all three needed, else 503 / channel skipped): `RESEND_API_KEY`, `RESEND_FROM` (sender, domain verified in Resend), `SITE_URL` (`https://…`, no path; used for links in mails). Read via `src/lib/email/config.ts`; the key is never printed. Production needs them in Vercel env too.
- Table `email_subscribers` (migration `0007`, email UNIQUE lowercase, random `unsubscribe_token`, nullable `user_id`). Applied to the production Neon DB and the `e2e-test` branch (2026-11-16).
- `src/lib/email/`: `resend.ts` (`sendBatch` → `POST api.resend.com/emails/batch`, 100 per call, one mail per recipient with its own `List-Unsubscribe`; errors carry only the status code), `template.ts` (`buildDigestEmail`: counts + up to 5 latest headlines linking to the original, HTML-escaped, http(s) links only), `subscribers.ts` (add/list/remove, max 20 addresses).
- Routes: `GET|POST|DELETE /api/email/subscription` and `POST /api/email/test` (admin token; the list never returns tokens), `POST /api/email/unsubscribe` (public, token-based, same reply for unknown tokens). Page `/email/unsubscribe?token=` needs a button press (mail scanners that prefetch the link must not unsubscribe anyone). UI: `src/components/email-subscribe.tsx` on `/notifications`.
- Digest (`src/lib/push/digest.ts`) is now multi-channel: `sendDigest(db, {push?, email?})`. Push and email each have their own `notification_settings` row (`channel` "push" / "email") and their own `lastDigestAt`, so one failing does not block or duplicate the other. `/api/cron/digest` sends on whichever channels are configured (503 only if neither).
- Not live-checked: no real mail sent (needs the user's Resend key + verified domain; Resend's test sender `onboarding@resend.dev` only delivers to the account owner's own address). Unit tests mock `fetch`; E2E blanks the Resend env.
- Migration journal gotcha: the production and `e2e-test` DBs had an older, different `0006` applied (from the unmerged `worktree-housing-image` branch: `image_url` + an unused `image_checked_at` column, journal time `1794576645896`). `main`'s `0006` journal `when` was changed to that same value so drizzle does not re-run it (it would fail with "column already exists"). Leave the extra column in place.

## Implemented (step 6, 뉴스 .ics 읽을 시간 알림)

- Branch `step6/news-ics`. `GET /api/articles/[id]/ics?when=evening|tomorrow|weekend` or `?date=YYYY-MM-DD` (public like the housing `.ics`; `Cache-Control: no-store`). Returns one timed event `[읽을 기사] <제목>` with the Korean summary + original link only (no article body), a 15-minute length and a `VALARM` at the start. 400 with a Korean reason for a bad/missing/past/over-1-year time, 404 for an unknown article.
- Times are Korea time (UTC+9, no DST), computed in `src/lib/news/reminder.ts` (pure, tested): evening = today 20:00 (tomorrow if past), tomorrow = 08:00, weekend = next Saturday 09:00 (a Saturday rolls to the next one), `date` = that day 09:00 (today allowed, max 365 days ahead).
- `src/lib/ics.ts` now supports all-day (`date`) and timed (`startAt`, UTC) events; only timed ones get an alarm. `PRODID` is `-//brief//KO`.
- UI: `src/components/reminder-menu.tsx` ("읽을 시간 알림" button on every news card, home and `/saved`): fetches the file and downloads it, shows the server's reason inline on errors. Housing keeps its own `.ics` link.
- E2E: `e2e/reminder.spec.ts`. Not checked by hand: importing the file into Google/Apple/Outlook calendar apps and the alarm firing.

## Implemented (step 7, Capacitor 앱 + 안드로이드 위젯 — 코드만, 빌드·실행 미확인)

- Branch `step7/capacitor-widget`. **Android only**: this PC has no JDK/Android SDK/Mac, so the native code was written but **never compiled or run** (iOS WidgetKit needs a Mac + Xcode and is not started). XML files were checked for well-formedness only; `WidgetDataTest.java` has not been run.
- Server side (verified by Vitest + E2E): `GET /api/widget/latest?limit=1..5` (default 3, public, short cache; only id/title/≤80-char summary/category/source/time and an in-app `path` like `/articles/7`, never the original URL or image) and the page `/articles/[id]` (one `ArticleCardItem`; widget/notification target). `src/app/not-found.tsx` is a friendly 404; because the page streams, a missing article still answers HTTP 200 with the "찾을 수 없어요" screen.
- Capacitor: `capacitor.config.ts` (appId `app.brief.news` — change it before any store release, it is hard to change later; appName 브리프). The app loads the deployed site: set `CAP_SERVER_URL=https://<deployed>` then `npm run cap:sync`. Without it the app shows `capacitor-www/index.html` (setup hint). `android/` is committed except what Capacitor's own `android/.gitignore` generates (assets/public, capacitor.config.json, config.xml). Open `android/` in Android Studio to build.
- Widget (Java, not Kotlin, to avoid Gradle changes): `BriefWidgetProvider` (4x2, refresh ≥30 min via `updatePeriodMillis`; fetches in a `goAsync` thread; reads the base URL from the bundled `capacitor.config.json` `server.url`; **https only**), `WidgetData` (pure parsing, only accepts in-app paths), layout/strings/XML under `android/app/src/main/res`, receiver in `AndroidManifest.xml`. Tapping a row sends an explicit `ACTION_VIEW` intent to `MainActivity`; `src/components/native-link-handler.tsx` (root layout, no-op in normal browsers) listens to Capacitor's `appUrlOpen` and routes via `src/lib/native-link.ts` (same-origin only).
- To verify by hand: build in Android Studio, add the widget on a device/emulator, check the 3 headlines, tap one → opens `/articles/<id>` in the app, and run `./gradlew test` for `WidgetDataTest`. The Android template's `ExampleInstrumentedTest` uses a different package name and would fail if run; ignore or delete it.
- `eslint.config.mjs` now ignores `.claude/**`, `android/**`, `capacitor-www/**` (before, `npm run lint` scanned leftover worktrees and reported ~19k problems).

## 홈 "설정" 버튼은 관리자에게만 (2026-11-17)

- `src/components/admin-only.tsx` wraps the home header's "설정" link (`src/app/page.tsx`). It reads the saved admin token, asks `GET /api/admin/check` (admin token → 200, else 401/503) and renders its children only on 200; while checking, with no token or with a wrong token it renders nothing. It re-checks (debounced 400 ms) on the `admin-token-change` window event (`ADMIN_TOKEN_EVENT`, dispatched by `setToken` in `src/app/admin/admin-api.tsx`) and on `storage`.
- `AdminOnly` takes an optional `fallback` for non-admins (nothing is drawn while the check is running, so admins see no flicker). Wrapped with it: the home "설정" link and "뉴스 가져오기" block, the `/housing` "청약 정보 가져오기" block, and on `/notifications` the push toggle + email address form (non-admins see "알림 설정은 관리자만 바꿀 수 있어요." instead). The token input field was removed from the home and `/housing`.
- This only hides the UI. Real protection is still each admin API's `requireAdmin`; the `/admin/*` pages open for anyone who types the URL but can do nothing without the token. Still visible to everyone: 저장함, the 알림 link, and the per-card 저장 button (it needs the token too and shows "관리 토큰이 필요해요…" without one; hiding it would also empty 저장함 for visitors, so it was left as is).
- **First-time access: the only place to type the token is `/admin/sources` (type the URL; every `/admin/*` page has the token field).** After that the hidden items appear on the home, `/housing` and `/notifications`. E2E: `e2e/admin-visibility.spec.ts`.

## 자동 수집: 새 것만 저장 (2026-11-17)

- Schedule (`vercel.json`): news **hourly** (`0 * * * *`), 청약 daily (06:30 KST), digest daily (07:00 KST). **Vercel's free (Hobby) plan only allows cron jobs once a day**, so an hourly schedule needs a paid plan; on Hobby the deploy/cron registration can be rejected. Check the actual plan before deploying and change the news schedule back to daily (`0 21 * * *`) if needed. Hourly runs are cheap because only new articles reach Claude (cap 40 per run).
- News (`syncNews`): articles whose URL is already stored (or whose title is nearly the same as a recent one) are skipped completely: not sent to Claude, not updated, no photo backfill. Only new articles are enriched and inserted.
- 청약 (`insertNewNotices` in `src/lib/housing/sync.ts`): `INSERT … ON CONFLICT (external_id) DO NOTHING`; a notice already stored is never overwritten, so **later schedule changes of an existing notice are not picked up** (a deliberate choice; the old behaviour updated them). Result fields: `inserted`, `existing` (was `updated`). After the insert the sync still classifies notices (`reclassifyHousingNotices`, local only) and looks up photos for notices not searched yet.
- E2E: `e2e/sync-dedupe.spec.ts` (housing against the test DB; news with a local RSS server and a fake Claude client that records what it receives). These tests clean up their own rows because other specs count articles and notices.

## E2E (Playwright)

- `npm run test:e2e` builds the app and runs it with `next start` on port 3200 (`playwright.config.ts`), then runs `e2e/*.spec.ts` at a 380px mobile viewport, one worker. First time: `npx playwright install chromium`.
- It uses its own Neon branch `e2e-test` (project `brief`), never the production database. The URL lives in the git-ignored `.env.e2e` (`E2E_DATABASE_URL`, `E2E_ADMIN_TOKEN`); the config passes it to the server as `DATABASE_URL`, so `.env.local` is overridden. Create `.env.e2e` in each new worktree (copy it from the main folder).
- `e2e/global-setup.ts` **wipes and reseeds** news/housing tables on that branch before every run (7 articles in 2 categories, 2 housing notices, all prefixed `[E2E]`) and refuses to run if the URL points at the same host as `DATABASE_URL` in `.env.local`. New migrations must be applied to the `e2e-test` branch too (set `DATABASE_URL` to the E2E URL for `npm run db:migrate`), or reset the branch from its parent.
- Claude and data.go.kr are not called (keys are blanked), so fetch buttons are not covered; seed data stands in for fetched rows.

## Implemented (청약 카드 사진, 네이버 API HUB)

- `housing_notices.image_url` (migration `0006`). `NO_IMAGE` (`""`) = searched, nothing suitable (not shown, not searched again); null = not searched yet.
- Env: `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `NAVER_OPEN_API_URL` are **Naver Cloud API HUB** keys (headers `X-NCP-APIGW-API-KEY-ID` / `X-NCP-APIGW-API-KEY`, path `/search/v1/image`), not developers.naver.com keys. Read via `src/lib/naver.ts`.
- `src/lib/housing/image.ts`: after each housing sync, `fillHousingImages` searches up to 40 unsearched notices (open/upcoming first). A result is used only if the title contains the complex name, is not ad-like (`UNWANTED`), is landscape (ratio 1.2–2, width ≥ 500) and either says 조감도/전경 etc. or comes from `TRUSTED_HOSTS` (press/review photos). Thumbnails are upgraded `b150` → `b360` (larger sizes 404). Only the URL is stored. Card uses the shared `CardImage`.
