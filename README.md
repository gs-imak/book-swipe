# BookSwipe 📚

A Next.js 14 (App Router) PWA for discovering books with a Tinder-style swipe deck.
Books are sourced live from public book APIs, your reading life is tracked locally in
`localStorage`, and an optional Supabase backend syncs it to the cloud. The app is
installable as a Progressive Web App and ships an in-app reader for public-domain titles.

> Package name: `book-tinder`.

## Features

- **Swipe to discover** — Tinder-style deck; swipe right to save, left to pass.
- **Live book data** — recommendations come from external APIs proxied through the
  app's own `app/api/*` routes:
  - **Google Books** (`/api/books`) — search and single-volume lookups.
  - **Open Library** (`/api/openlibrary`) — trending (daily/weekly/monthly) feeds.
  - **Project Gutenberg** via [gutendex](https://gutendex.com) (`/api/gutenberg-browse`)
    for free/public-domain browsing, with a baked-in fallback dataset when gutendex
    is unreachable.
- **In-app reader** — reads public-domain book text fetched through `/api/gutenberg-text`
  (Project Gutenberg, host-allowlisted).
- **Local-first tracking** — liked books, reviews, notes, reading progress, shelves,
  and a daily pick all persist in `localStorage` (with safe quota handling).
- **Optional cloud sync** — when Supabase is configured, reading data can sync to a
  user account; otherwise the app runs fully offline/anonymous.
- **Gamification** — points, achievements, streaks, and reading challenges.
- **PWA** — web app manifest + service worker (`public/sw.js`); installable with an
  install prompt and offline support.

## Tech Stack

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Tailwind CSS** with **shadcn/ui** (Radix UI primitives) and **CVA**
- **Framer Motion** for swipe/animation
- **Supabase** (`@supabase/supabase-js`) for optional auth + cloud sync
- **Vitest** + Testing Library for tests

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables** — create `.env.local` in the project root:

   ```bash
   # Server-only — proxied through /api/books; do NOT prefix with NEXT_PUBLIC.
   GOOGLE_BOOKS_API_KEY=your-google-books-api-key

   # Optional — enables Supabase auth + cloud sync. Omit to run fully local.
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

   # Optional — only used by the setup script below (never shipped to the client).
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

   Open Library and Project Gutenberg/gutendex require no keys.

3. **Run the dev server**

   ```bash
   npm run dev
   ```

   Then open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script | Command | Description |
| --- | --- | --- |
| `npm run dev` | `next dev` | Start the development server. |
| `npm run build` | `next build` | Build for production. |
| `npm start` | `next start` | Run the production build. |
| `npm run lint` | `next lint` | Lint with ESLint (`eslint-config-next`). |
| `npm run typecheck` | `tsc --noEmit` | Type-check without emitting. |
| `npm test` | `vitest run` | Run the test suite once. |
| `npm run test:watch` | `vitest` | Run tests in watch mode. |

### Supabase setup (optional)

The schema lives in `lib/supabase-schema.sql`. PostgREST cannot run arbitrary DDL, so
apply the schema in the Supabase dashboard SQL editor (or via `npx supabase db query`),
then verify the tables with:

```bash
node scripts/setup-db.mjs
```

The script reads `SUPABASE_SERVICE_ROLE_KEY` from the environment or `.env.local`,
checks the connection, and reports which expected tables exist. It does **not** create
tables.

## Architecture

```
app/
  api/
    books/             # Google Books proxy (server-only API key, rate-limited)
    openlibrary/       # Open Library trending feeds proxy (path-allowlisted)
    gutenberg-browse/  # gutendex browse proxy + baked-in fallback dataset
    gutenberg-text/    # Project Gutenberg text proxy (host-allowlisted) for the reader
  layout.tsx           # Root layout, fonts, metadata, no-FOUC theme script
  page.tsx             # App entry / shell
components/            # UI: swipe deck, reader, dashboard, gamification, shelves, etc.
  ui/                  # shadcn/ui primitives
lib/
  books-api.ts, openlibrary-api.ts, gutenberg-*.ts, explore-api.ts  # API clients
  storage.ts           # localStorage data layer (liked books, reviews, progress, ...)
  supabase.ts          # Supabase client (null when env vars are absent)
  supabase-sync.ts     # Cloud sync of local reading data
  theme.ts             # Theme persistence (key "bookswipe_theme", "dark" class on <html>)
  gamification.ts, achievements.ts, daily-pick.ts, scoring-engine.ts, ...
public/
  manifest.json, sw.js # PWA manifest + service worker
scripts/
  setup-db.mjs         # Supabase table verification helper
```

Data flows client → app `/api/*` route → external API. Server-only secrets
(`GOOGLE_BOOKS_API_KEY`) stay on the server; the browser only talks to the app's own
API routes. Without Supabase env vars the app degrades gracefully to a fully local,
anonymous experience.
