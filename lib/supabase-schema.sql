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
  unique(user_id, book_id)
);

-- ─── Reviews ────────────────────────────────────────────────────────────────
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text not null references public.books(id) on delete cascade,
  rating numeric(2,1) not null, -- supports half-stars (4.5, 3.5, etc.)
  review_text text,
  favorite boolean default false,
  mood text,
  pace text, -- slow, medium, fast
  format text, -- print, ebook, audiobook
  tags text[] default '{}',
  content_warnings text[] default '{}',
  dimensions jsonb, -- {plot: 4, characters: 5, writing: 3, emotion: 4, originality: 5}
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, book_id)
);

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
  direction text not null, -- 'left' or 'right'
  swiped_at timestamptz default now(),
  unique(user_id, book_id)
);

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

-- Books: anyone can read, authenticated users can insert (shared catalog)
create policy "Anyone can read books" on public.books for select to authenticated using (true);
create policy "Authenticated users can insert books" on public.books for insert to authenticated with check (true);

-- User books: users can CRUD their own
create policy "Users manage own library" on public.user_books for all using (auth.uid() = user_id);

-- Reviews: users can CRUD their own, anyone can read (for collaborative filtering)
create policy "Anyone can read reviews" on public.reviews for select to authenticated using (true);
create policy "Users manage own reviews" on public.reviews for insert with check (auth.uid() = user_id);
create policy "Users update own reviews" on public.reviews for update using (auth.uid() = user_id);
create policy "Users delete own reviews" on public.reviews for delete using (auth.uid() = user_id);

-- Reading progress: users can CRUD their own
create policy "Users manage own progress" on public.reading_progress for all using (auth.uid() = user_id);

-- Swipe history: users can CRUD their own, select for collaborative filtering
create policy "Anyone can read swipes" on public.swipe_history for select to authenticated using (true);
create policy "Users manage own swipes" on public.swipe_history for insert with check (auth.uid() = user_id);

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

-- ─── Collaborative Filtering View ──────────────────────────────────────────
-- "Users who liked X also liked Y" — materialized for performance
create or replace view public.book_co_likes as
select
  a.book_id as book_a,
  b.book_id as book_b,
  count(distinct a.user_id) as co_like_count
from public.swipe_history a
join public.swipe_history b
  on a.user_id = b.user_id
  and a.book_id < b.book_id
  and a.direction = 'right'
  and b.direction = 'right'
group by a.book_id, b.book_id
having count(distinct a.user_id) >= 2;
