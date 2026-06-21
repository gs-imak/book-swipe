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

## Deployment & launch checklist

See `.env.example` for every environment variable. The app builds and runs with
only `GOOGLE_BOOKS_API_KEY`; everything else is optional and degrades gracefully.

### Deploy

1. Push to a Git repo and import it in your host (Vercel recommended for Next.js).
2. Set environment variables from `.env.example` in the host's project settings.
3. Point a custom domain at the deployment and enable HTTPS.

### Cloud accounts & sync (optional but needed for multi-device)

1. Create a Supabase project; copy URL + anon key into env.
2. Apply the schema: run `lib/supabase-schema.sql` in the Supabase SQL editor,
   then verify with `node scripts/setup-db.mjs`. This sets up RLS, the co-likes
   RPC, and `delete_my_account` (used by Settings → Delete account).
3. **Email is required for real signups/resets.** Supabase's built-in email is
   rate-limited and not for production — configure a custom SMTP provider
   (Resend / Postmark) in Supabase → Auth → SMTP.
4. For Google sign-in: create OAuth credentials, add the Supabase callback URL,
   and set your deployed `/privacy` URL on the OAuth consent screen (required).

### Before you launch (checklist)

- [ ] **Legal:** fill in the placeholders in `app/privacy/page.tsx` and
      `app/terms/page.tsx` (entity, contact email, governing law) and have the
      copy reviewed. Linked from Settings → About and the sign-up screen.
- [ ] **Email:** custom SMTP configured in Supabase (see above).
- [ ] **Error monitoring:** set `NEXT_PUBLIC_SENTRY_DSN` (client errors report to
      Sentry; inert when unset).
- [ ] **Analytics:** set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` for cookieless analytics
      (no consent banner needed).
- [ ] **Support:** update `SUPPORT_EMAIL` in `components/settings-page.tsx` and
      the contact addresses in the legal pages.
- [ ] **Rate limiting:** the API route limiter is per-instance/best-effort. For
      real protection against quota abuse, move it to a shared store (Upstash).
- [ ] Run `npm run lint && npm run typecheck && npm test && npm run build`.

Architecture decisions live in `docs/adr/`; the domain glossary is `CONTEXT.md`.
