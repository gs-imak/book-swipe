import { NextRequest, NextResponse } from "next/server"
import { generateObject } from "ai"
import { z } from "zod"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

// LLM prose gap-fill for the enrichment pipeline (ADR-0005). Runs ONLY when a
// book's description is still thin after the Google Books / Open Library
// stages. The model contributes an ORIGINAL editorial hook in its own words —
// never facts (ratings, series, dates come from APIs alone) and never copied
// or closely-paraphrased marketing copy. `known:false` gates hallucination:
// a book the model doesn't specifically recognize gets nothing.
//
// Same gateway/auth/fail-soft shape as /api/recommend (ADR-0003).

const MODEL = process.env.ENRICH_MODEL || "anthropic/claude-haiku-4.5"
const GENERATION_TIMEOUT_MS = 15_000

const schema = z.object({
  known: z
    .boolean()
    .describe("true ONLY if you specifically recognize this exact book"),
  hook: z.string().describe("2-3 sentence original hook, empty when known=false"),
})

export async function POST(request: NextRequest) {
  const hasGatewayAuth = !!(
    process.env.AI_GATEWAY_API_KEY ||
    process.env.VERCEL_OIDC_TOKEN ||
    process.env.VERCEL
  )
  if (!hasGatewayAuth) return NextResponse.json({ known: false, hook: "" })

  const ip = getClientIp(request)
  if (!(await checkRateLimit(ip, { limit: 30, windowMs: 60_000, prefix: "enrich" }))) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } },
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const title = String(body.title ?? "").slice(0, 150)
  const author = String(body.author ?? "").slice(0, 100)
  if (!title || !author) return NextResponse.json({ known: false, hook: "" })
  const genre = Array.isArray(body.genre)
    ? body.genre.map((g) => String(g).slice(0, 40)).slice(0, 5).join(", ")
    : ""
  const subjects = Array.isArray(body.subjects)
    ? body.subjects.map((s) => String(s).slice(0, 60)).slice(0, 8).join("; ")
    : ""
  const existing = String(body.existingDescription ?? "").slice(0, 400)

  const prompt = `You are a sharp literary editor writing ORIGINAL jacket-style hooks for a book-discovery app.

Book: "${title}" by ${author}
Categories: ${genre || "(unknown)"}
Subjects: ${subjects || "(unknown)"}
Existing thin description: "${existing || "(none)"}"

If you specifically recognize THIS exact book:
- known = true
- hook = 2-3 sentences in your OWN words: the premise, the stakes, and what makes it distinctive. No spoilers beyond the setup. Write fresh copy — do not reproduce or closely paraphrase any publisher blurb or text from the book itself.

If you do not specifically recognize this exact book by this author:
- known = false, hook = "". Never guess, never invent plot details.`

  try {
    const { object } = await generateObject({
      model: MODEL,
      schema,
      prompt,
      abortSignal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
    })
    // No cache header: CDNs don't cache POST responses anyway. Repeat calls
    // are prevented client-side — the enriched marker persists per book and
    // the in-flight map dedupes concurrent surfaces.
    return NextResponse.json({
      known: object.known,
      hook: object.known ? object.hook.slice(0, 900) : "",
    })
  } catch (err) {
    console.error("[BookSwipe] enrich route error:", err instanceof Error ? err.message : String(err))
    return NextResponse.json({ known: false, hook: "" })
  }
}
