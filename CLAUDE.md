# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Roadmap steps 1–7 and 9 are done in code (setup; source/category CRUD with admin UI; news fetch + card UI; 저장 and /saved; PWA, web push, Resend email, Vercel Cron; news `.ics` reminders; Capacitor Android app + widget; 청약 notices), tagged `v0.7` (`v0.6` = through step 6, `v0.5` = through step 5). **Step 7's Android code has never been compiled or run** (no JDK/SDK on the dev PC); only its server side is tested. Migrations 0000–0014 are applied to both the production Neon DB and the `e2e-test` branch (0008–0013 are the 2026-11-20 features; 0014 `site_visits` was applied to production on 2026-11-21, checked via `drizzle.__drizzle_migrations`). Any new migration must still be applied to both before deploying code that uses it. Step 3 was live-checked (real RSS + Claude). Live-checked in 5: web push test notification on localhost with a production build (2026-11-17, desktop browser). Still unchecked live: step 9 (data.go.kr), step 6 (importing the `.ics` into a real calendar app), and in step 5 the real Resend mail, push on a phone / from the deployed origin, the daily digest, and Vercel Cron after deploy. Remaining roadmap: 8 (Clerk). Still open in step 7: build and try the Android app/widget on a device or emulator once the site is deployed (set `CAP_SERVER_URL`), and the iOS widget (needs a Mac). `src/app/page.tsx` is the news feed (fetch button, category tabs, cards, pagination). Unit tests are Vitest (`src/**/*.test.ts`), E2E is Playwright (`e2e/`, see "E2E" below). `PRD.md` (Korean) is the source of truth for features, data model (section 5), roadmap (section 8) and open questions (section 11). Implement only when the user says so, one roadmap step at a time.

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
- `src/lib/housing/`: `applyhome.ts` (api.odcloud.kr client + tolerant field mapper, raw row kept), `classify.ts` (pure keyword rule), `sync.ts` (fetch → insert new notices / update changed schedules → `reclassifyHousingNotices`), `queries.ts`, `status.ts`. Any category/feed mutation calls `reclassifyHousingNotices`.
- Field names in `mapNotice` were written from the public API docs and not yet checked against a live response.
- Routes: `/api/housing/{feeds,categories,fetch}` (admin) and `/api/housing/notices/[id]/ics` (public). Pages: `/housing` (server, Suspense for searchParams/DB because `cacheComponents` is on), `/admin/housing-{feeds,categories}`.
## Implemented (step 3, 뉴스 가져오기 + 카드 UI)

- `POST /api/news/fetch` (admin) → `syncNews` in `src/lib/news/sync.ts`: parse active `sources` in parallel (one failure doesn't stop others), skip stored URLs, cap 40 new per run (chosen by hot topic per category when over the cap, see "자동 수집"), batches of 5 to Claude (10 overflowed max_tokens and got truncated) (`src/lib/news/enrich.ts`, model `NEWS_MODEL` = claude-haiku-5-5, RSS snippet only, Zod-validated). A failed batch is not saved, so it is retried next run. Needs `ANTHROPIC_API_KEY` (503 if unset). Live-checked: 40 saved, 0 failed batches.
- Dedupe (`src/lib/news/dedupe.ts`, tested): URLs are normalised before the stored-URL check, and near-identical titles are dropped so the same story is not sent to Claude twice.
- Home `/` (`src/app/page.tsx`, server, Suspense for searchParams/DB): `fetch-news-button.tsx` calls the fetch API, category tabs use `?category=<id>`, cards show the category (미분류 when null), `ARTICLES_PER_PAGE` = 6 with `src/components/pagination.tsx` (first/prev/numbers/…/next/last; page logic in `src/lib/page-items.ts`). Queries live in `src/lib/news/queries.ts`.
- E2E covers card list, pagination, category filter and save; the fetch button flow (real Claude) is not in E2E.
- The three sample sources (ids 1–3, `example.com` URLs) and their 6 dummy articles (`https://example.com/news/1..6`) were deleted from the production DB on 2026-11-17 (the sources 404ed on every fetch). A fresh database seeded from `scripts/seed-sample.ts` would bring them back, so do not run that script against production.
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

- `vercel.json` schedules `GET /api/cron/news` (daily, `0 21 * * *` UTC = 06:00 KST) and `GET /api/cron/housing` (daily, `30 21 * * *` = 06:30 KST); see "자동 수집" below. The routes reuse `syncNews` / `syncHousing`, the same code as the buttons.
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
- UI: the "읽을 시간 알림" card button (`reminder-menu.tsx`) was **removed on 2026-11-20** at the user's request; the API above is still there. Housing keeps its own `.ics` link.
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

- Schedule (`vercel.json`), all **once a day** because the project runs on Vercel's free (Hobby) plan (one run per cron job per day, run time only accurate to the hour): news `0 21 * * *` (06:00 KST), 청약 `30 21 * * *` (06:30 KST), digest `0 22 * * *` (07:00 KST, always after the other two since Hobby runs inside the scheduled hour). Hourly news would need a paid plan.
- News (`syncNews`): articles whose URL is already stored (or whose title is nearly the same as a recent one) are skipped completely: not sent to Claude, not updated, no photo backfill. Only new articles are enriched and inserted.
- **News cap (40 new per run, `opts.maxNew` only for tests) and how the 40 are chosen**: if there are more new articles than the cap, `src/lib/news/select.ts` picks them "by hot topic per category". Hotness = how many outlets (then how many articles) covered the same story (title similarity ≥ 0.45, looser than the 0.7 duplicate rule; duplicates are collapsed first but still counted), then newest. Categories come from `classifyTitles` in `enrich.ts` (one cheap Claude call per 100 titles, titles only, only when over the cap); the 40 slots are filled round-robin over categories in `sort_order` (uncategorised last), best of each category first. If the classification call fails, the pick falls back to hotness only and the failure is listed in `failedBatches`. `selectedByHotTopics` in the result says whether this ran. With a single RSS source hotness is always 1, so the choice reduces to newest first within each category. The rest (`skippedByCap`) is only fetched later if it is still in the feed.
- 청약 (`saveNotices` in `src/lib/housing/sync.ts`): new notices are inserted; a stored notice is updated **only when its schedule changed** (모집공고일 `announced_on`, 접수 시작 `receipt_start`, 접수 종료 `receipt_end`, 당첨자 발표 `winner_on`, compared with `IS DISTINCT FROM` via `ON CONFLICT … DO UPDATE … WHERE`). Only those four dates, `raw` and `updated_at` are written; name, supply count, address etc. are never overwritten, and a null date from the API never erases a stored one. Result fields: `inserted`, `updated`, `unchanged`. After that the sync classifies notices (`reclassifyHousingNotices`, local only) and looks up photos for notices not searched yet.
- E2E: `e2e/sync-dedupe.spec.ts` (housing against the test DB; news with local RSS servers and a fake Claude client that records what it receives, including the hot-topic pick and the classification-failure fallback). These tests clean up their own rows because other specs count articles and notices.

## E2E (Playwright)

- `npm run test:e2e` builds the app into `.next-e2e` (`NEXT_DIST_DIR`, so a running `next dev` on `.next` does not collide) and runs it with `next start` on port 3200 (`playwright.config.ts`), then runs `e2e/*.spec.ts` at a 380px mobile viewport, one worker. First time: `npx playwright install chromium`.
- It uses its own Neon branch `e2e-test` (project `brief`), never the production database. The URL lives in the git-ignored `.env.e2e` (`E2E_DATABASE_URL`, `E2E_ADMIN_TOKEN`); the config passes it to the server as `DATABASE_URL`, so `.env.local` is overridden. Create `.env.e2e` in each new worktree (copy it from the main folder).
- `e2e/global-setup.ts` **wipes and reseeds** news/housing tables on that branch before every run (7 articles in 2 categories, 2 housing notices, all prefixed `[E2E]`) and refuses to run if the URL points at the same host as `DATABASE_URL` in `.env.local`. New migrations must be applied to the `e2e-test` branch too (set `DATABASE_URL` to the E2E URL for `npm run db:migrate`), or reset the branch from its parent.
- Claude and data.go.kr are not called (keys are blanked), so fetch buttons are not covered; seed data stands in for fetched rows.

## Implemented (청약 카드 사진, 네이버 API HUB)

- `housing_notices.image_url` (migration `0006`). `NO_IMAGE` (`""`) = searched, nothing suitable (not shown, not searched again); null = not searched yet.
- Env: `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `NAVER_OPEN_API_URL` are **Naver Cloud API HUB** keys (headers `X-NCP-APIGW-API-KEY-ID` / `X-NCP-APIGW-API-KEY`, path `/search/v1/image`), not developers.naver.com keys. Read via `src/lib/naver.ts`.
- `src/lib/housing/image.ts`: after each housing sync, `fillHousingImages` searches up to 40 unsearched notices (open/upcoming first). A result is used only if the title contains the complex name, is not ad-like (`UNWANTED`), is landscape (ratio 1.2–2, width ≥ 500) and either says 조감도/전경 etc. or comes from `TRUSTED_HOSTS` (press/review photos). Thumbnails are upgraded `b150` → `b360` (larger sizes 404). Only the URL is stored. Card uses the shared `CardImage`.

## 2026-11-20 추가 기능 (브랜치별로 개발해 main에 `--no-ff` 병합, 브랜치는 이름을 남기려고 지우지 않았다)

- `remove-sample-data`: 운영 DB의 샘플 청약 공고 5건(`SAMPLE-2026-001~005`) 삭제. 뉴스 기사 318건은 전부 실제 RSS 기사였다. `scripts/seed-sample.ts` 는 `ALLOW_SAMPLE_SEED=1` 이 없으면 실행을 거부한다.
- `loading-overlay`: `src/components/busy-overlay.tsx`. `useBusy(진행중, "문구")` 를 부르면 화면 가운데 로딩 안내(200ms 뒤에 나타남, 여러 개가 겹치면 마지막 것 하나). 화면 이동(`navigation-progress`), 저장·알림·이메일·캘린더 버튼, 관리자 API(`useAdminApi().call` 이 요청 중 자동으로 켬, `busyLabel` 로 문구 지정)에 연결돼 있다.
- `saved-per-visitor`: 로그인(8단계) 전까지 사람 구분은 `src/lib/visitor.ts` 의 httpOnly 쿠키 `brief_vid`(UUID)이고 DB `user_id` 에는 `v:<uuid>` 로 적는다. 저장 API(`/api/saved/[id]`, `/api/housing/saved/[id]`)는 **관리 토큰 없이** 이 방문자의 저장함에만 쓴다. 이전의 `user_id` null 저장 행(운영 DB에 기사 1건)은 아무에게도 보이지 않는다. 읽기 전용 화면은 `readVisitorId()`(쿠키를 만들지 않음), 쓰는 API만 `ensureVisitorId()`.
- `hide-notification-button`: 홈의 "알림" 버튼은 `AdminOnly` 안에 있다(`/notifications` 주소는 그대로 열림). `hide-empty-categories`: 홈 카테고리 탭은 기사가 1건 이상인 카테고리만 보인다(`listCategories(db, {onlyWithArticles:true})`, 기사가 들어오면 자동으로 나타남). 운영 DB의 "메인"·"추천"이 기사 0건이었다.
- `my-page`: `/my`(닉네임·관심 카테고리·내 활동), 테이블 `visitor_profiles`(0008), `/api/my/profile`. 닉네임이 없으면 `익명 XXXX`(방문자 번호 끝 4자리).
- `share-button`: `ShareButton`(기기 공유 창 → 링크 복사 → 직접 복사 칸). 뉴스 카드·청약 카드·청약 사진 화면·커뮤니티 글에 있고, `/articles/[id]` 는 `generateMetadata` 로 og 정보를 낸다(`SITE_URL` 이 있으면 `metadataBase`). 앱(Capacitor)에서 `navigator.share` 가 없으면 링크 복사로 대신한다(네이티브 공유 플러그인은 넣지 않았다).
- `news-feed-for-me`: 홈 목록 제목은 "뉴스 피드". `MainNav`(`src/components/main-nav.tsx`)에 바로가기 항목을 더하면 홈과 각 모아보기 화면에 나온다. `/for-me` = 마이페이지에서 고른 관심 카테고리 + 자주 저장한 소식의 카테고리(상위 3개).
- `article-ai-insights`: `articles.insight_one_line/learned/perspective`(0009). 새 기사는 `enrichBatch` 가 요약과 함께 만들고(해설이 빠져도 기사 저장은 막지 않음), 기존 기사는 관리자 홈의 "AI 해설 채우기" 버튼(`POST /api/news/insights`, 한 번에 40건, 최신부터)으로 채운다. 제목·한국어 요약만 근거로 하고 편들기·투자·정치 판단 표현 금지 규칙이 프롬프트(`INSIGHT_RULES`)에 있다. **운영 DB에는 아직 채우지 않았다**(마이그레이션 전이라).
- `five-minute-issues`: `/five-minute`. 조회는 `article_views`(0010, 방문자·기사·한국 날짜당 1건; 원문 보기 클릭과 `/articles/[id]` 열기에서 `POST /api/articles/[id]/view`). 최근 48시간 기사 중 분야별 오늘 조회수 1위 → 조회수 높은 분야부터 5개, 분야가 모자라면 남은 기사로 채움(`pickFiveMinute`). 뉴스 크론이 30일 지난 조회 기록을 지운다.
- `housing-photos`: 청약 카드 "청약 사진 보기" → `/housing/[id]`(조감도·평면도·배치도·모델하우스). `housing_notices.photos` jsonb(0011)에 네이버 이미지 검색 결과 주소만 저장(처음 열 때 검색, 빈 결과는 7일 뒤 재검색, 키가 없거나 실패하면 저장하지 않고 안내). 카드 대표사진용 `image.ts` 와 달리 평면도·배치도도 받는다. E2E는 `NAVER_*` 를 비워 둔다.
- `community`: `/community`(목록·글쓰기·상세·댓글), 테이블 `community_posts/comments/reports`(0012). 방문자별 닉네임(쓸 때 이름을 그대로 저장), 글 1시간 5개·댓글 20개 제한, 서로 다른 3명이 신고하면 자동으로 가려짐(`/admin/community` 에서 되살리기/삭제), 본인 또는 관리자만 삭제. 글은 글자 그대로 출력(HTML 실행 안 됨).
- `admin-error-console`: `/admin` 은 관리 메뉴, `/admin/*` 는 `AdminOnly` 로 감싸 토큰이 맞을 때만 내용이 보인다. 오류 코드 `E-WEB|APP|SRV-xxxxx`(`src/lib/errors/code.ts`: 숫자·주소·긴 식별자를 지우고 해시, 같은 원인은 같은 코드), 테이블 `error_events`(0013). 수집: 브라우저·앱 `ErrorReporter`(+`error.tsx`/`global-error.tsx` 가 사용자에게 코드를 보여 줌, 오프라인 실패 등 잡음 제외, 화면당 5건) → `POST /api/errors`(공개, 같은 사이트 Origin만, 서로 다른 코드 500종 상한), 서버는 `src/instrumentation.ts` 의 `onRequestError`. 관리 화면 `/admin/errors`: 상태·출처 필터, 해결됨/무시/다시 열기/삭제(해결한 오류가 다시 나면 자동으로 처리 전), 서버 점검(DB, 마지막 뉴스·공고 시각, 설정 키 유무 — 값은 보여 주지 않음). 해결·무시한 기록은 90일 뒤 뉴스 크론이 정리한다.
- E2E 주의: Cache Components 때문에 이전 화면이 숨겨진 채 DOM에 남을 수 있다 → `getByLabel`/`getByText` 가 숨은 화면까지 잡으니 `getByRole`(보이는 것만)이나 `locator("article")` 처럼 범위를 좁힌다. `getByRole(..., {name: new RegExp("[E2E] ...")})` 는 `[E2E]` 가 문자 클래스가 되므로 문자열을 쓴다. 새 테이블을 만들면 `e2e/global-setup.ts` 의 비우기 목록에 넣는다.

## 2026-11-21 화면 정리 (사용자 요청)

- 홈(`/`)에는 관리자 버튼이 없다: 알림·설정·뉴스 가져오기·토큰 입력칸 모두 제거. 알림 설정과 청약 정보 가져오기는 관리 메뉴(`/admin`)에서만 보이고(`AdminOnly`), 관리 화면의 위쪽 바로가기도 토큰이 맞을 때만 보인다. 일반 홈의 날짜·"오늘 새 소식 N개, 지금까지 N개" 문구도 숨겼다(눈에 안 띄는 `h1` 만 남김).
- **"뉴스 가져오기"와 "AI 해설 채우기" 버튼은 어디에도 그리지 않는다**(`src/app/fetch-news-button.tsx` 는 남겨 둠, 다시 쓰려면 `/admin` 페이지에 `<FetchNewsButton />`). API(`/api/news/fetch`, `/api/news/insights`)와 매일 자동 수집(크론)은 그대로이고 토큰 없이는 401이다.
- 운영 DB에서 연합뉴스(`sources.id=4`)를 `active=false` 로 끄고 그 기사 109건을 지웠다(저장·제보 연결 없음). 다시 쓰려면 `/admin/sources` 에서 켠다(켜면 다음 수집 때 다시 들어온다).
- `/api/news/insights`(AI 해설 채우기)는 504를 막으려고 시간 예산(30초)·동시 3묶음으로 처리하고, 남은 건 클라이언트가 이어서 호출하게 되어 있다(버튼을 숨긴 지금은 호출할 곳이 없다).

## 2026-11-21 관리자 화면 개편 (브랜치 `dashboard`, 아직 커밋·병합 안 함)

- **잠금 화면**: `/admin/*` 는 `src/app/admin/admin-gate.tsx` 가 막는다. 저장된 토큰이 없거나 틀리면 "관리자 잠금" 화면이 나오고, 토큰을 입력해 "잠금 해제"를 누르면 서버(`GET /api/admin/check`)가 확인한 뒤에만 저장하고 연다(틀린 토큰은 저장 안 함). 헤더의 "잠금" 버튼이 토큰을 지워 다시 잠근다. 다른 탭에서 토큰이 바뀌거나 API가 401을 주면 provider(`admin-api.tsx`)가 따라가 다시 확인한다. 예전 `TokenField` 입력칸은 더 이상 안 쓴다(파일은 남아 있음).
- **틀·메뉴**: `admin-shell.tsx`(위쪽 바 + 이동 탭, 현재 화면 표시), 메뉴 목록은 `admin-menu.ts` 한 곳(탭과 대시보드 카드에 같이 나옴; 새 관리 화면은 여기에만 더한다). 대시보드 `/admin`: 오늘 방문자·페이지뷰·처리 전 오류·마지막 수집 카드, 최근 7일 방문자 차트, 청약 가져오기·알림 설정·오류 확인 버튼, 묶음별 관리 메뉴. 색은 브리프 토큰(`bg-surface`, `border-line`, `text-sub`, `bg-brand`…); `ok`/`no` 색을 `globals.css` 에 등록했다. 뉴스 가져오기·AI 해설 채우기 버튼은 여전히 숨김.
- **방문자·트래픽**: 테이블 `site_visits`(마이그레이션 `0014`, 방문 1건 = 1행: 한국 날짜·시, 방문자 `v:<uuid>`, 숫자를 `:id` 로 합친 경로, web/app). `src/components/visit-tracker.tsx`(루트 레이아웃, Suspense 안)가 화면을 열 때 `POST /api/analytics/visit` 를 부른다. **운영 빌드에서만** 보내고(개발 서버가 운영 DB에 쌓지 않게), 관리 토큰이 있는 브라우저·`/admin`·`/api`·봇 UA·다른 Origin 은 세지 않는다. IP·쿼리는 저장하지 않고 90일 뒤 뉴스 크론이 지운다(`pruneVisits`). 집계는 `src/lib/traffic/store.ts`(`getTraffic`: 일별 방문자·페이지뷰, 오늘 시간대별, 인기 화면 10개, 웹/앱, 처음/다시 온 방문자), 글자 만들기는 `format.ts`, API `GET /api/admin/traffic?days=7|14|30`(관리자), 화면 `/admin/traffic`(차트는 라이브러리 없이 `bar-chart.tsx`). "트래픽"은 페이지뷰 기준이고 전송량(GB)은 Vercel Usage 에서 본다.
- **마이그레이션**: `0014`(`site_visits`)는 `e2e-test` 브랜치와 운영 DB 모두에 적용했다(2026-11-21). 운영 DB의 `site_visits` 는 비어 있고, 이 코드가 배포돼야 방문 기록이 쌓이기 시작한다(개발 서버·관리자·봇은 기록하지 않음). 테이블이 없을 때 `/admin/traffic` 은 "방문 기록 테이블이 아직 없어요" 안내를 띄운다.
- E2E: `e2e/admin-console.spec.ts`(잠금·탭·방문 기록 API·통계 화면), `admin-visibility.spec.ts` 는 새 잠금 흐름에 맞춰 고쳤다. 단위 테스트 `src/lib/traffic/traffic.test.ts`.
