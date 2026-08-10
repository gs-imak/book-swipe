# Enrichment: facts from APIs only, prose from the LLM only

Status: amended by ADR-0006 (stable facts may now come LLM-first behind the
cached `/api/book-facts` route; live metrics remain API-only).

Book enrichment (`lib/book-enrichment.ts`) fills Goodreads-parity metadata in
two API stages (Google Books per-volume, Open Library ISBN→work with title
validation against foreign editions) and one LLM stage (`/api/enrich`) that
runs only when the description is still thin afterwards. The split is a hard
rule: ratings counts, series, and years come exclusively from the APIs, while
the LLM may only write an original editorial hook and must return
`known:false` for books it doesn't specifically recognize — so no factual
field can ever be hallucinated, extending ADR-0003's containment pattern.
Enrichment is two-stage lazy (visible books in the background, guaranteed on
Showcase/modal open) and marks `metadata.enriched` only when a stage landed,
so offline sessions retry later.
