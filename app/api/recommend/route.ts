import { NextRequest, NextResponse } from "next/server"
import { generateObject } from "ai"
import { z } from "zod"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

// LLM-direct book recommender. Given the books a user has loved, an LLM reasons
// about their underlying taste and returns titles + a one-line "why". The client
// resolves each title against Google Books for real metadata/covers (dropping any
// that don't resolve), so a hallucinated title can never reach the UI.
//
// Routed through the Vercel AI Gateway via a model string (no provider SDK / no
// provider key in code) — gives unified billing, routing, and failover.
//
// INERT WITHOUT A KEY: if AI_GATEWAY_API_KEY is unset the route returns an empty
// list and the client falls back to the existing local scoring engine. To enable,
// set AI_GATEWAY_API_KEY (and optionally RECOMMENDER_MODEL). See ADR-0003.
//
// generateObject is verified present in ai@6 (v6 migration guide + exported
// function); a model string resolves through the gateway (LanguageModel accepts
// GlobalProviderModelId).

const MODEL = process.env.RECOMMENDER_MODEL || "anthropic/claude-haiku-4.5"
const GENERATION_TIMEOUT_MS = 20_000

const schema = z.object({
  recommendations: z.array(
    z.object({
      title: z.string(),
      author: z.string(),
      reason: z.string(),
    }),
  ),
})

interface LikedInput {
  title?: unknown
  author?: unknown
  genre?: unknown
}

export async function POST(request: NextRequest) {
  // No gateway key → no-op. Client treats an empty list as "use the local engine".
  if (!process.env.AI_GATEWAY_API_KEY) {
    return NextResponse.json({ recommendations: [], reason: "not configured" })
  }

  // LLM calls cost money — rate limit harder than the metadata proxies.
  const ip = getClientIp(request)
  if (!(await checkRateLimit(ip, { limit: 20, windowMs: 60_000, prefix: "recommend" }))) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } },
    )
  }

  let body: { likedBooks?: unknown; excludeTitles?: unknown; limit?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const liked: LikedInput[] = Array.isArray(body.likedBooks) ? body.likedBooks.slice(0, 30) : []
  const exclude: string[] = Array.isArray(body.excludeTitles)
    ? body.excludeTitles.map((t) => String(t).slice(0, 120)).slice(0, 100)
    : []
  const limit = Math.min(Math.max(1, Number(body.limit) || 12), 20)
  if (liked.length === 0) return NextResponse.json({ recommendations: [] })

  const likedList = liked
    .map((b) => {
      const title = String(b.title ?? "").slice(0, 120)
      const author = String(b.author ?? "").slice(0, 80)
      const genre = Array.isArray(b.genre) ? b.genre.join(", ").slice(0, 60) : ""
      return `- "${title}" by ${author}${genre ? ` [${genre}]` : ""}`
    })
    .filter((l) => l.length > 6)
    .join("\n")

  const prompt = `You are an expert, discerning book recommender — think a brilliant independent bookseller who remembers exactly why someone loved a book.

A reader has loved these books:
${likedList}

Recommend ${limit} books they are most likely to LOVE next.

Rules:
- Infer their underlying taste — themes, tone, pacing, character types, prose style — not just the surface genre.
- Only real, findable, published books. Give the correct title and primary author.
- Do NOT recommend anything they already have. Avoid these titles: ${exclude.join("; ") || "(none)"}.
- Mostly strong matches, plus a couple of non-obvious gems. Avoid the most overexposed bestsellers unless they are a near-perfect fit.
- Each reason is ONE specific sentence tied to their taste signal (reference what they liked), not generic praise.
Return exactly ${limit} recommendations.`

  try {
    const { object } = await generateObject({
      model: MODEL,
      schema,
      prompt,
      abortSignal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
    })
    return NextResponse.json(
      { recommendations: object.recommendations.slice(0, limit) },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (err) {
    // Fail soft — the client falls back to the local engine on an empty list.
    console.error("[BookSwipe] recommend route error:", err instanceof Error ? err.message : String(err))
    return NextResponse.json({ recommendations: [], error: "generation failed" })
  }
}
