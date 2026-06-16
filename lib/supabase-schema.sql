-- BookSwipe Database Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)

-- ─── Users Profile (extends Supabase auth.users) ────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  reader_archetype text,
  level integer default 1,
  total_points integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── Books (shared catalog — deduplicated by source + source_id) ────────────
create table if not exists public.books (
  id text primary key, -- google books id or gutenberg-{id}
  title text not null,
  author text not null,
  cover text default '',
  cover_fallback text,
  rating numeric(3,1) default 0,
  pages integer default 0,
  genre text[] default '{}',
  mood text[] default '{}',
  description text default '',
  published_year integer default 0,
  isbn text,
  subjects text[] default '{}',
  created_at timestamptz default now()
);

-- ─── User's Liked Books (their library) ─────────────────────────────────────
create table if not exists public.user_books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text not null references public.books(id) on delete cascade,
  shelf text default 'want-to-read', -- want-to-read, currently-reading, finished, dnf
  format text, -- print, ebook, audiobook
  date_added timestamptz default now(),
  -- updated_at: bumped on every sync write so last-writer-wins conflict
  -- resolution can compare device freshness (see supabase-sync.ts syncToCloud).
  updated_at timestamptz default now(),
  unique(user_id, book_id)
);
-- If this table already exists from an earlier deploy, add the new column:
alter table public.user_books add column if not exists updated_at timestamptz default now();

-- ─── Reviews ────────────────────────────────────────────────────────────────
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text not null references public.books(id) on delete cascade,
  -- numeric(3,1) (was numeric(2,1), which overflows for any value >= 10).
  -- The CHECK pins ratings to the valid 0..5 half-star range so a bad client
  -- payload (e.g. rating 99) is rejected at the DB instead of silently stored.
  rating numeric(3,1) not null check (rating >= 0 and rating <= 5), -- supports half-stars (4.5, 3.5, etc.)
  review_text text,
  favorite boolean default false,
  mood text,
  pace text, -- slow, medium, fast
  format text, -- print, ebook, audiobook
  tags text[] default '{}',
  content_warnings text[] default '{}',
  dimensions jsonb, -- {plot: 4, characters: 5, writing: 3, emotion: 4, originality: 5}
  -- Reading-session metadata that the local BookReview carries. Previously these were
  -- dropped on sync (syncFromCloud hardcoded them to undefined) because no columns
  -- existed. They are stored here so the round-trip preserves them (P2-A 6b).
  date_started timestamptz,
  date_finished timestamptz,
  reading_time_minutes integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, book_id)
);
-- If this table already exists from an earlier deploy, add the new columns:
alter table public.reviews add column if not exists date_started timestamptz;
alter table public.reviews add column if not exists date_finished timestamptz;
alter table public.reviews add column if not exists reading_time_minutes integer;

-- ─── Reading Progress ───────────────────────────────────────────────────────
create table if not exists public.reading_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text not null references public.books(id) on delete cascade,
  current_page integer default 0,
  total_pages integer default 0,
  time_spent_minutes integer default 0,
  status text default 'reading', -- reading, paused, completed, dnf
  started_date timestamptz default now(),
  last_read_date timestamptz default now(),
  unique(user_id, book_id)
);

-- ─── Swipe History (for collaborative filtering) ────────────────────────────
create table if not exists public.swipe_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text not null references public.books(id) on delete cascade,
  direction text not null check (direction in ('left', 'right')), -- 'left' or 'right'
  swiped_at timestamptz default now(),
  -- updated_at lets recordSwipe keep the most-recent swipe when the same
  -- (user, book) is swiped again (e.g. re-decided a previous left/right).
  updated_at timestamptz default now(),
  unique(user_id, book_id)
);
-- If this table already exists from an earlier deploy, add the new column:
alter table public.swipe_history add column if not exists updated_at timestamptz default now();

-- ─── Indexes ────────────────────────────────────────────────────────────────
create index if not exists idx_user_books_user on public.user_books(user_id);
create index if not exists idx_user_books_book on public.user_books(book_id);
create index if not exists idx_reviews_user on public.reviews(user_id);
create index if not exists idx_reviews_book on public.reviews(book_id);
create index if not exists idx_reading_progress_user on public.reading_progress(user_id);
create index if not exists idx_swipe_history_user on public.swipe_history(user_id);
create index if not exists idx_swipe_history_book on public.swipe_history(book_id);
create index if not exists idx_books_genre on public.books using gin(genre);

-- ─── Row Level Security ─────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.user_books enable row level security;
alter table public.reviews enable row level security;
alter table public.reading_progress enable row level security;
alter table public.swipe_history enable row level security;

-- Profiles: users can read/update their own profile
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Migration safety: drop the OLD (pre-hardening) policies by their original names so
-- re-running this script on a live instance actually removes the leaky SELECT policies
-- instead of erroring on the renamed ones / leaving the old ones in force.
drop policy if exists "Authenticated users can insert books" on public.books;
drop policy if exists "Anyone can read reviews" on public.reviews;
drop policy if exists "Users manage own reviews" on public.reviews;
drop policy if exists "Users update own reviews" on public.reviews;
drop policy if exists "Users delete own reviews" on public.reviews;
drop policy if exists "Anyone can read swipes" on public.swipe_history;
drop policy if exists "Users manage own swipes" on public.swipe_history;
-- And the new names, so this whole block is idempotent on repeat runs.
drop policy if exists "Users read own reviews" on public.reviews;
drop policy if exists "Users read own swipes" on public.swipe_history;
drop policy if exists "Users insert own swipes" on public.swipe_history;
drop policy if exists "Users update own swipes" on public.swipe_history;
drop policy if exists "Users delete own swipes" on public.swipe_history;

-- Books: any authenticated user can read the shared catalog.
create policy "Anyone can read books" on public.books for select to authenticated using (true);

-- Catalog writes are INSERT-ONLY. There is deliberately NO update/delete policy
-- on books, so once a catalog row exists it is immutable from the client: a user
-- cannot overwrite (vandalise) title/author/cover/etc. of a book another user
-- already inserted. The WITH CHECK also rejects rows missing the required fields,
-- so a client cannot seed empty/garbage catalog entries.
--
-- IMPORTANT for the client (see supabase-sync.ts upsertBook): because there is no
-- UPDATE policy, an upsert that hits an existing id would have its ON CONFLICT
-- UPDATE branch blocked by RLS. The client therefore upserts with
-- ignoreDuplicates so the conflict path is a no-op INSERT instead of a denied
-- UPDATE. Net effect: first writer creates the row, later writers are no-ops.
create policy "Authenticated users can insert books" on public.books
  for insert to authenticated
  with check (
    auth.uid() is not null
    and title is not null and length(title) > 0
    and author is not null and length(author) > 0
  );

-- User books: users can CRUD their own
create policy "Users manage own library" on public.user_books for all using (auth.uid() = user_id);

-- Reviews: users can CRUD ONLY their own rows.
-- SECURITY FIX (P1-4): the old policy was `for select to authenticated using (true)`,
-- which let ANY logged-in user read EVERY other user's review_text, mood, pace,
-- dimensions, etc. Collaborative filtering does NOT need raw per-user review rows —
-- it only needs aggregate co-like counts, which are now served by the
-- security-definer RPC public.get_co_like_counts() below (no per-user data leaks).
-- syncFromCloud only ever reads the caller's own reviews (.eq user_id), so own-row
-- SELECT is sufficient for the app.
create policy "Users read own reviews" on public.reviews for select using (auth.uid() = user_id);
create policy "Users manage own reviews" on public.reviews for insert with check (auth.uid() = user_id);
create policy "Users update own reviews" on public.reviews for update using (auth.uid() = user_id);
create policy "Users delete own reviews" on public.reviews for delete using (auth.uid() = user_id);

-- Reading progress: users can CRUD their own
create policy "Users manage own progress" on public.reading_progress for all using (auth.uid() = user_id);

-- Swipe history: users can CRUD ONLY their own rows.
-- SECURITY FIX (P1-4): the old policy was `for select to authenticated using (true)`,
-- exposing every user's full swipe history (which books they liked/rejected and when)
-- to any logged-in account. Collaborative filtering now goes through the
-- security-definer RPC public.get_co_like_counts() (aggregate counts only), so the
-- client never needs to read other users' raw swipe rows.
create policy "Users read own swipes" on public.swipe_history for select using (auth.uid() = user_id);
create policy "Users insert own swipes" on public.swipe_history for insert with check (auth.uid() = user_id);
-- Allow the client to update its own swipe row when a (user, book) is re-swiped
-- (recordSwipe upserts on the unique (user_id, book_id) and bumps updated_at).
create policy "Users update own swipes" on public.swipe_history for update using (auth.uid() = user_id);
-- DELETE preserved: the old "Users manage own swipes" (for all) covered delete; keep an
-- explicit own-row delete policy so account-deletion / un-swipe paths still work.
create policy "Users delete own swipes" on public.swipe_history for delete using (auth.uid() = user_id);

-- ─── Auto-create profile on signup ──────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists, then create
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Collaborative Filtering ───────────────────────────────────────────────
-- SECURITY NOTE (P2-B): the previous `book_co_likes` VIEW has been REMOVED. A plain
-- view runs with the *querying user's* RLS, and once swipe_history SELECT is locked
-- to own-rows (above) the view would only ever see the caller's own swipes — useless
-- for cross-user recommendations. The fix is a `security definer` RPC that runs with
-- the function owner's privileges so it CAN aggregate across all users, but returns
-- ONLY aggregate counts (book_id -> how many other users liked it). No per-user rows,
-- no other user's review_text/mood/swipe direction history ever crosses the boundary.
-- Drop the old view if a previous deploy created it.
drop view if exists public.book_co_likes;

-- get_co_like_counts(liked_book_ids):
--   Given the caller's liked book IDs, find OTHER users who also swiped right on at
--   least one of those books, then return the aggregate count of right-swipes those
--   users gave to books the caller has NOT liked. Result: book_id -> co_like_count,
--   ordered strongest-signal-first. This replaces both the leaky view and the
--   client-side cross-user swipe_history reads in getCollaborativeRecs().
--
-- Inputs are passed as a text[] PARAMETER (never string-interpolated), so book IDs
-- containing commas/quotes/parens cannot break or inject into the query (P1-5).
-- The function is `security definer` + `set search_path` (prevents search_path
-- hijacking) and is intentionally limited to aggregate output only.
create or replace function public.get_co_like_counts(liked_book_ids text[])
returns table (book_id text, co_like_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  with neighbours as (
    -- other users who right-swiped at least one of the caller's liked books
    select distinct sh.user_id
    from public.swipe_history sh
    where sh.direction = 'right'
      and sh.book_id = any (liked_book_ids)
      and sh.user_id <> auth.uid()
  )
  select sh.book_id, count(distinct sh.user_id) as co_like_count
  from public.swipe_history sh
  join neighbours n on n.user_id = sh.user_id
  where sh.direction = 'right'
    and not (sh.book_id = any (liked_book_ids)) -- exclude books caller already liked
  group by sh.book_id
  order by co_like_count desc;
$$;

-- Allow logged-in clients to call the aggregate RPC. EXECUTE is on the function only;
-- the underlying swipe_history rows remain unreadable to them via the table policies.
revoke all on function public.get_co_like_counts(text[]) from public;
grant execute on function public.get_co_like_counts(text[]) to authenticated;
