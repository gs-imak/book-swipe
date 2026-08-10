# Book facts are LLM-first for stable facts, behind one globally-cached route

Amends ADR-0005. Per-user client fetches to Google Books / Open Library made
every user re-spend external quota per book (and shared-IP 429s were easy to
hit). Enrichment now goes through `/api/book-facts`: external fetches carry a
30-day `next.revalidate` so Vercel's data cache spends quota roughly once per
unique book globally, and the LLM supplies STABLE literary facts first
(description, genres, series, first-published) gated on `known:false` for
unrecognized books. The containment line moves, deliberately: ADR-0005's
"facts never from the LLM" becomes "LIVE METRICS never from the LLM" —
ratings counts/averages remain API-only (Google Books primary, Open Library
`ratings.json` fallback), while API values verify and override the model's
series/year/genres on conflict. Description is prose, not a stable fact:
longest real text wins, so the model's hook only beats an API stub. Optional `GOOGLE_BOOKS_API_KEY` moves GB
calls onto project quota; without it the cache still carries the load.
