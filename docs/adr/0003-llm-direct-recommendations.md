# Recommendations are LLM-direct, not embeddings/pgvector

Status: accepted

## Context

The local engine (`scoring-engine.ts`) is a TF-IDF + collaborative hybrid — solid,
but **lexical**: it matches shared words/tags, so it can't tell two books share
"morally-grey leads and slow-burn dread" unless those words appear. We wanted a
genuinely *semantic*, explainable recommender. The obvious path was embeddings +
pgvector; the Software-3.0 reframe asked whether an LLM could just *be* the engine.

## Decision

Recommend **LLM-direct**, skipping the embeddings/pgvector pipeline:

- `/api/recommend` sends the user's liked books to an LLM (via the **Vercel AI
  Gateway**, model string `anthropic/claude-haiku-4.5`, `generateObject` + a Zod
  schema) and gets back `{title, author, reason}[]`.
- The client (`recommend-client.ts`) resolves each title against Google Books for
  real metadata/covers and **drops anything that doesn't resolve** — so a
  hallucinated or mis-attributed title can never reach the UI.
- Resolved books lead the swipe deck; the `reason` powers the existing "why this
  book" pill. Cached per liked-set (6h TTL) to bound cost/latency.
- **Inert without `AI_GATEWAY_API_KEY`**: the route returns an empty list and the
  deck falls back to the existing TF-IDF engine. Cold start (<3 likes) also uses
  the local engine. The collaborative co-likes signal stays as a separate input.

## Consequences

- The LLM does the semantic understanding for free — no embedding model, no
  pgvector, no vector cache to maintain. Explanations come from the same call.
- Costs money + adds latency per fresh liked-set (mitigated by caching + the
  20s timeout + a tighter rate limit on the route).
- Hallucination is contained by the Google-Books resolution gate, not trusted.
- Embeddings/pgvector remain a future option *only if* LLM cost/latency become a
  real problem at scale.
- Auth uses `AI_GATEWAY_API_KEY` for an explicit on/off switch; OIDC via
  `vercel env pull` is an alternative on Vercel (no key rotation) — documented in
  `.env.example`.
