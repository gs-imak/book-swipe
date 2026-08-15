# Descriptions are quality-selected and banded, and the LLM is the copy desk

Amends ADR-0005/0006. Description selection was "longest text wins", which is
not a policy but a lottery over edition metadata — measured against 62 books it
picked Open Library every time (its wiki text is simply longer), dragging in
Markdown, encyclopedia ledes, edition marketing and links to pirated-PDF sites,
with lengths from 528 to 3450 characters.

Selection is now by quality score in `lib/description-clean.ts`: each candidate
is cleaned (entities decoded, block tags turned into whitespace rather than
deleted so words never run together, link/marketing/boilerplate classes
removed), disqualified when it is the wrong genre of writing (Wikipedia lede,
review-quote wrapper, catalogue stub), then trimmed on a sentence boundary to a
180–300 character band. Length survives only as a tiebreak inside that band.
The band is derived from the app's own clamps: the Showcase panel holds ~306
characters at tablet widths and has no expander, so anything longer is silently
deleted on the flagship surface.

When no candidate clears the bar, the LLM stops competing on length and becomes
the **copy desk** — it rewrites to house style in original words, within the
band, and returns `status: "cannot"` rather than inventing a plot for a book it
does not know. Everything it writes goes back through the same cleaner and the
`isPublishable` gate, so no path can emit markup, a URL, or out-of-band text.
The same cleaner also runs at the origin point (`books-api.ts`) and as the
fallback in the client, so a book is never rendered from raw source markup.
`metadata.enriched.pipelineVersion` reprocesses books enriched before this.
