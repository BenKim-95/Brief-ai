# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Roadmap steps 1–2 are done (setup; source/category CRUD with admin UI). `src/app/page.tsx` is still the create-next-app sample. `PRD.md` (Korean) is the source of truth for features, data model (section 5), roadmap (section 8) and open questions (section 11). Implement only when the user says so, one roadmap step at a time.

## Commands

- `npm run dev` / `npm run build` / `npm start`
- `npm run lint` (ESLint 9, flat config)
- `npm test` (vitest run); single test: `npx vitest run path/to/file.test.ts -t "name"`
- `npm run test:e2e` (Playwright; run `npx playwright install` once first)
- `npm run db:generate` / `npm run db:migrate` (drizzle-kit reads `DATABASE_URL` from the shell env, not `.env.local`; e.g. `node --env-file=.env.local node_modules/drizzle-kit/bin.cjs migrate`). Migrations live in `drizzle/`.

## Stack and gotchas

- Next.js 16 (App Router, `src/` dir, alias `@/*`), React 19, Tailwind 4, TypeScript. `AGENTS.md` warns this Next.js version has breaking changes: read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code.
- `tsc --noEmit` reports `Cannot find name 'LayoutProps'` until Next generates route types (`next build`/`next dev`). It is not a real error.
- shadcn/ui is initialised (`components.json`, `src/components/ui`); `cn` comes from the `cn` package via `src/lib/utils.ts`.
- `@types/node` is pinned to ^24 because vitest 5 has a peer conflict with ^20.

## Planned architecture (from PRD)

- Neon Postgres + Drizzle; tables: sources, categories, articles (url UNIQUE), saved_articles, push_subscriptions, notification_settings. `user_id` is nullable everywhere so Clerk can be added later (step 8).
- Fetch flow: Route Handler pulls active RSS sources, dedupes by URL, sends only new articles to Claude in batches for Korean title, summary and category, validates the response with Zod, then saves. Never re-call Claude for stored articles.
- Sources, categories and notification settings are DB rows managed through admin UI/API, never hardcoded. Admin APIs need a minimal secret-token guard until login exists.
- Product constraints: show only summary plus original link (no full article text); polite Korean "~해요" copy; no investment or political-judgment wording; mobile-first (about 380px, centred 480–560px max width).

## Implemented (step 2)

- `src/db/schema.ts` has only `sources` and `categories` so far. `getDb()` in `src/db/index.ts` is lazy, so builds work without `DATABASE_URL`.
- `src/app/api/{sources,categories}` Route Handlers use Zod schemas from `src/lib/schemas.ts` and helpers from `src/lib/api.ts`. Every handler starts with `requireAdmin()` (`x-admin-token` header vs `ADMIN_TOKEN`; 503 if unset). Source create/update validates the RSS via `src/lib/rss.ts` (`rss-parser`).
- `src/app/admin/**` are client pages; the token is typed into the page and kept in `sessionStorage` (`admin-api.tsx`).
- Step 3 TODO: `articles.category_id` FK must be `ON DELETE SET NULL` so a deleted category falls back to "미분류".
