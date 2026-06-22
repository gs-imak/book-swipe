#!/usr/bin/env node
/**
 * Quality eval for the LLM-direct recommender (ADR-0003). Runs sample taste
 * profiles through the same model + schema the route uses, then resolves each
 * recommendation against Google Books — reporting resolution rate, duplicates,
 * recommended-an-already-liked-book leaks, and missing reasons.
 *
 * Skips cleanly if AI_GATEWAY_API_KEY is unset. Run: node scripts/eval-recommender.mjs
 * Needs AI_GATEWAY_API_KEY (recommender) and GOOGLE_BOOKS_API_KEY (resolution).
 */
import { readFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
try {
  const env = readFileSync(resolve(__dirname, "..", ".env.local"), "utf-8")
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
} catch {
  /* no .env.local */
}

if (!process.env.AI_GATEWAY_API_KEY) {
  console.log("SKIP: AI_GATEWAY_API_KEY not set — recommender is inert. Set it to run the eval.")
  process.exit(0)
}

const { generateObject } = await import("ai")
const { z } = await import("zod")

const MODEL = process.env.RECOMMENDER_MODEL || "anthropic/claude-haiku-4.5"
const GOOGLE_KEY = process.env.GOOGLE_BOOKS_API_KEY

const schema = z.object({
  recommendations: z.array(z.object({ title: z.string(), author: z.string(), reason: z.string() })),
})

const PROFILES = [
  { name: "epic-fantasy", liked: ["The Name of the Wind", "Mistborn", "The Way of Kings"] },
  { name: "literary-thriller", liked: ["Gone Girl", "The Silent Patient", "Sharp Objects"] },
  { name: "productivity-nonfiction", liked: ["Atomic Habits", "Deep Work", "The Power of Habit"] },
]

async function resolves(title, author) {
  if (!GOOGLE_KEY) return null // can't check resolution without a key
  const q = encodeURIComponent(`intitle:"${title}" inauthor:"${author}"`)
  try {
    const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1&key=${GOOGLE_KEY}`)
    if (!r.ok) return false
    const d = await r.json()
    return (d.items?.length ?? 0) > 0
  } catch {
    return false
  }
}

let totalFail = 0
for (const profile of PROFILES) {
  const prompt = `A reader loved: ${profile.liked.map((t) => `"${t}"`).join(", ")}. Recommend 10 books they'd love next. Real, findable books only; correct title + author; do not recommend any they already have; each reason one specific sentence tied to their taste.`
  let recs = []
  try {
    const { object } = await generateObject({ model: MODEL, schema, prompt })
    recs = object.recommendations
  } catch (e) {
    console.log(`✗ ${profile.name}: generation failed — ${e.message}`)
    totalFail++
    continue
  }

  const titles = recs.map((r) => r.title.toLowerCase().trim())
  const dupes = titles.length - new Set(titles).size
  const likedLower = new Set(profile.liked.map((t) => t.toLowerCase().trim()))
  const leakedLiked = titles.filter((t) => likedLower.has(t)).length
  const missingReason = recs.filter((r) => !r.reason || r.reason.length < 10).length

  let resolved = 0
  if (GOOGLE_KEY) {
    const checks = await Promise.all(recs.map((r) => resolves(r.title, r.author)))
    resolved = checks.filter(Boolean).length
  }
  const resolveRate = GOOGLE_KEY ? `${resolved}/${recs.length}` : "n/a (no GOOGLE_BOOKS_API_KEY)"

  const ok = dupes === 0 && leakedLiked === 0 && missingReason === 0 && (!GOOGLE_KEY || resolved >= recs.length * 0.7)
  if (!ok) totalFail++
  console.log(`${ok ? "✓" : "✗"} ${profile.name}: ${recs.length} recs | resolved ${resolveRate} | dupes ${dupes} | leaked-liked ${leakedLiked} | missing-reason ${missingReason}`)
  console.log(`    e.g. "${recs[0]?.title}" — ${recs[0]?.reason}`)
}

console.log(totalFail === 0 ? "\nEVAL PASSED" : `\n${totalFail} PROFILE(S) FAILED`)
process.exit(totalFail === 0 ? 0 : 1)
