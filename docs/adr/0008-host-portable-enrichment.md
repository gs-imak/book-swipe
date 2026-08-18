# Enrichment resolves books by title, and stays portable off Vercel

Amends ADR-0006. Two problems, one of which only showed up as a user-visible
bug: every book that reached the deck from Open Library carried the placeholder
"Discover this book on your reading journey." and never lost it.

## Why books had no description

`/api/book-facts` had three sources and each was gated on an identifier the
book usually didn't have:

- `gbFacts` needed a Google **volume id**, which no Open Library book has, so
  Google was skipped without being tried.
- `olFacts` needed an **ISBN**, and even when given a correct one it failed:
  `openlibrary.org/isbn/{isbn}.json` answers with a redirect that measured
  **~24s** against a 6s budget, and the edition record it eventually returns
  carries **no description** — the text lives on the linked *work*.
- `llmFacts` needed the AI Gateway, which is not enabled.

So `mergeBookFacts(null, null, null)` returned `{found:false}` and the client
kept the placeholder. Measured on production before the change:
`?title=The Way of Kings&author=Brandon Sanderson` returned `found:false` both
with and without a valid ISBN.

**Decision:** resolve by **title + author**, the only identifier every book in
the deck actually has. Open Library is resolved through `search.json`, which
returns the work key directly — one hop shorter than the ISBN route and far
faster. Google Books gets an `intitle:`/`inauthor:` fallback for books with no
volume id. Both keep their title-overlap guard, because a search returns
companions, study guides and box sets alongside the real book.

Query form is chosen by measured latency, not by apparent precision:

| Open Library query | Time |
|---|---|
| `q=<title> <author>` (free text) | **3.5s** |
| `title=…&author=…` (fielded) | 6–20s |
| `q=title:(…) AND author:(…)` | did not return within 21s |

Free text runs first; the fielded form stays as a fallback for titles too
generic to survive it.

## Why some descriptions were still dropped

`trimToSentenceBand` accumulated whole sentences while under the 300-char
ceiling and stopped at the first one that would exceed it. When a short hook is
followed by a long sentence, that left a stub under the 180-char floor, which
was then rejected outright — so a book with a perfectly good blurb ended up
with nothing. Real case: *Atomic Habits* has an 86-char opening sentence and a
229-char second one; the pair is 315, so only the 86-char hook survived.

**Decision:** when the greedy prefix falls under the floor, search the windows
of consecutive sentences for the one closest to the ideal length. Earlier
windows win ties, so the natural opening is kept whenever it fits; dropping the
hook is a last resort, not a preference.

## Portability (a move off Vercel is expected)

**Decision:** nothing on this path may test for the *host*. It may only test
for a *capability*.

- `hasGatewayAuth` previously included `process.env.VERCEL`, which is always
  `"1"` on Vercel. That made the guard true on every Vercel deployment whether
  or not the gateway was reachable, and false everywhere else even with a key
  present — wrong on both sides of a move. It now tests only for a real
  credential (`AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN`). Same fix applied to
  `/api/recommend`, which had the identical guard.
- The 30-day `next.revalidate` on external fetches is a **Next.js** feature,
  not a Vercel one, and survives self-hosting on any Node runtime.
- A bounded per-instance memo now sits in front of that cache, so the
  "spend external quota once per unique book" property still holds on a host
  where the data cache is absent, disabled, or cleared on deploy.
- Rate limiting already degrades from Upstash REST (plain `fetch`, no SDK) to
  an in-process map, and no route declares an edge runtime or a Vercel-only
  region.

What a move still requires: set `AI_GATEWAY_API_KEY` (or point the AI SDK at
another provider) if generation is wanted, and set the Upstash pair if durable
rate limiting is wanted. Neither is needed for descriptions to work.

## Result

Sampled 15 real books through the live route and read every output: **13 have a
real description** (was 0 for Open-Library-sourced books), all within the
180–306 band, length spread 1.45x. The two misses are the quality bar doing its
job — both are encyclopedia ledes ("*A Little Life* is a 2015 novel by…") that
the pipeline refuses rather than ships. Enabling the gateway would let the copy
desk rewrite those into house style.
