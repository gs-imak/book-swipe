// Book-description cleaning, scoring and selection. PURE: no fetch, no
// storage, no React — every export is synchronous and deterministic so the
// whole module is unit-testable.
//
// Why this exists: descriptions arrive from Google Books (HTML jacket copy,
// consistently long) and Open Library (wiki-style Markdown, wildly variable —
// 59 to 3450 chars, including links to pirated-PDF sites). Selecting the
// LONGEST candidate — the policy this module replaces — systematically picked
// the most contaminated text. Selection is now by quality score, and every
// published description lands in one narrow band so cards feel consistent.
//
// Band rationale (measured against the app's own clamps, not a round number):
// the Showcase panel clamps to 4 lines at tablet widths and has NO "more"
// expander, which holds ~306 chars; crossing that silently deletes text on the
// flagship surface. 300 is that ceiling minus ragged-right margin. The floor is
// the widest 3-line box in the app (the swipe card's ABOUT block at lg).

/** Bump to reprocess every already-enriched book. Stored on
 *  `metadata.enriched.pipelineVersion`; the client gate compares against it. */
export const DESCRIPTION_PIPELINE_VERSION = 2

/** Publish floor — below this the widest 3-line box renders under-filled. */
export const DESC_MIN_CHARS = 180
/** Fills ~88% of the tablet Showcase box, so the last line reads finished. */
export const DESC_IDEAL_CHARS = 270
/** The tablet Showcase clamp, minus margin. Above this, text is silently cut. */
export const DESC_MAX_CHARS = 300
/** Below this nothing can fill any surface and repair is impossible. */
export const DESC_FATAL_FLOOR_CHARS = 120
/** A cleaned SOURCE candidate under this is a catalogue stub, not copy. */
export const SOURCE_MIN_CHARS = 200
/** Score at which cleaned source text ships as-is, with no LLM rewrite. */
export const ACCEPT_SCORE = 78
/** Below this a candidate is not even worth handing the LLM as material. */
export const REPAIR_SCORE = 55
/** Source material handed to the copy desk is capped to bound token cost. */
export const LLM_SOURCE_MATERIAL_MAX_CHARS = 1200
/** Guard against catastrophic backtracking on adversarial records. */
const MAX_INPUT_CHARS = 20_000

/** Placeholder strings that have shipped as "descriptions" over time. */
export const PLACEHOLDER_DESCRIPTIONS: readonly string[] = [
  "No description available.",
  "Discover this book on your reading journey.",
  "",
]

export type CandidateSource = "google" | "openlibrary" | "llm"

export type DefectCode =
  | "empty"
  | "placeholder"
  | "html-tag"
  | "entity-residue"
  | "word-join"
  | "markdown-link"
  | "pirate-pdf-link"
  | "bare-url"
  | "email"
  | "markdown-footnote"
  | "markdown-emphasis"
  | "markdown-heading"
  | "markdown-list-item"
  | "horizontal-rule"
  | "ol-crosslink-boilerplate"
  | "source-attribution-tail"
  | "wikipedia-lede"
  | "review-quote-wrapper"
  | "review-quote-attribution"
  | "praise-award-banner"
  | "all-caps-shouting"
  | "edition-format-boilerplate"
  | "comp-titles-marketing"
  | "backlist-or-about-author"
  | "bullet-glyph-list"
  | "publisher-tag-block"
  | "hashtag-spam"
  | "star-rating-glyphs"
  | "doubled-quote-mark"
  | "exotic-space"
  | "midword-truncation"
  | "no-terminal-punctuation"
  | "too-short"
  | "too-long"

export interface CleanResult {
  text: string
  /** Defect classes actually removed, deduped, in encounter order. */
  removed: DefectCode[]
}

export interface TrimResult {
  text: string
  truncated: boolean
  fitsBand: boolean
}

export interface ScoreResult {
  score: number
  fatal: DefectCode[]
  disqualifying: DefectCode[]
  penalties: DefectCode[]
}

/* ── entities ─────────────────────────────────────────────────────────── */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  mdash: "—", ndash: "–", hellip: "…", lsquo: "‘", rsquo: "’",
  ldquo: "“", rdquo: "”", bull: "•", middot: "·", deg: "°",
  copy: "©", reg: "®", trade: "™", laquo: "«", raquo: "»", times: "×",
  divide: "÷", eacute: "é", egrave: "è", agrave: "à", ccedil: "ç",
  uuml: "ü", ouml: "ö", auml: "ä", ntilde: "ñ", szlig: "ß",
  ensp: " ", emsp: " ", thinsp: " ", shy: "",
}

function decodeOnce(s: string): string {
  return s
    .replace(/&([a-z]{2,8});/gi, (m, name: string) => {
      const hit = NAMED_ENTITIES[name.toLowerCase()]
      return hit === undefined ? m : hit
    })
    .replace(/&#(\d{1,7});/g, (m, dec: string) => {
      const cp = Number(dec)
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m
    })
    .replace(/&#x([0-9a-f]{1,6});/gi, (m, hex: string) => {
      const cp = parseInt(hex, 16)
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m
    })
}

/** Decoded twice so double-encoded input (`&amp;#39;`) resolves. Runs BEFORE
 *  tag stripping so an entity-smuggled tag becomes a real tag and is removed
 *  rather than surfacing as visible markup. */
function decodeEntities(s: string): string {
  return decodeOnce(decodeOnce(s))
}

/* ── the cleaning pipeline ────────────────────────────────────────────── */

const BLOCK_TAG =
  /<\s*\/?\s*(?:br|p|div|li|ul|ol|dl|dd|dt|h[1-6]|blockquote|section|article|tr|td|table|hr)\b[^<>]*\/?>/gi
// Tag-SHAPED, so prose like "5 < 10 > 3" survives. The trailing \/? matters:
// a bare /<[^>]*>/ misses nothing but /<\/?[a-z]...>/ without it misses <br/>.
const INLINE_TAG = /<\/?[a-z][a-z0-9-]*(?:\s[^<>]*)?\/?>/gi

const PIRATE_HOSTS =
  /(?:chesserresources|pdfdrive|z-lib|zlibrary|libgen|annas-archive|epubpub|bookfrom)\./i

/** Sentence-aware truncation markers: everything after these was never prose. */
const CUT_MARKERS: Array<[DefectCode, RegExp]> = [
  ["horizontal-rule", /(?:^|\n)[ \t]*(?:-{3,}|_{3,}|\*{3,})[ \t]*(?=\n|$)/],
  [
    "ol-crosslink-boilerplate",
    /(?:^|\n)[ \t]*\*{0,2}(?:Also contained in|Contained in|Followed by|Preceded by|Also in)\b/i,
  ],
  [
    "backlist-or-about-author",
    /\b(?:About the Author|Look for more titles|Also by [A-Z]|Other books (?:by|in) |Don'?t miss\b|Read on for\b)/,
  ],
  ["hashtag-spam", /#[A-Za-z][A-Za-z0-9_]{3,}(?:[ \t]+#[A-Za-z][A-Za-z0-9_]{3,})+/],
  ["source-attribution-tail", /\(\s*(?:Source|Klappentext)\s*[:\)]/i],
]

/** Whole-line junk, only ever stripped from the head or tail of the text. */
const LINE_JUNK: Array<[DefectCode, RegExp]> = [
  [
    "praise-award-banner",
    /#\s?1\s+(?:NEW YORK TIMES|NATIONAL|INTERNATIONAL|SUNDAY TIMES)|NEW YORK TIMES BESTSELLER|INSTANT[ A-Z]{0,20}BESTSELLER|WINNER OF THE\b|SHORTLISTED FOR\b|LONGLISTED FOR\b|NOW A (?:MAJOR|NETFLIX|NEW)\b|SOON TO BE A\b|\bstarred reviews?\b|GOODREADS CHOICE AWARD|PULITZER PRIZE (?:WINNER|FINALIST)|OVER \d[\d,. ]{0,12}(?:MILLION )?COPIES SOLD/i,
  ],
  ["review-quote-attribution", /["“][^"“”]{25,}["”]\s*[-–—]{1,2}\s*[A-Z]/],
  ["markdown-heading", /^[ \t]{0,3}#{1,6}[ \t]+/],
  ["star-rating-glyphs", /[⭐★☆]{2,}/],
  ["publisher-tag-block", /^\[(?:[A-Z][\w&.'’ -]{1,30},[ \t]*){2,}[^\]\r\n]{0,60}\]$/],
  ["all-caps-shouting", /^[^a-z]{12,}$/],
]

/** Marketing that lives inside a sentence rather than on its own line. */
const SENTENCE_JUNK: Array<[DefectCode, RegExp]> = [
  [
    "comp-titles-marketing",
    /\b(?:for (?:readers|fans|aficionados|lovers) of|perfect for fans of|if you (?:liked|loved|enjoyed)|in the (?:tradition|vein) of|will appeal to (?:readers|fans))\b/i,
  ],
  [
    "edition-format-boilerplate",
    /\b(?:Penguin (?:Classics|Hardcover|Modern Classics)|HarperPerennial Classics|Digital Rights Management|Illustrated edition|[Cc]ollector'?s edition|\d{1,3}(?:TH|ST|ND|RD) ANNIVERSARY EDITION|[Ww]ith (?:a|an) new (?:introduction|afterword|foreword)|With an Introduction by|Introduction and Notes by|reading group guide|boxed set)\b/,
  ],
]

function pushOnce(list: DefectCode[], code: DefectCode) {
  if (!list.includes(code)) list.push(code)
}

/** Back up to the end of the last complete sentence before `idx`. */
function backToSentenceEnd(s: string, idx: number): string {
  const head = s.slice(0, idx)
  const m = head.match(/[\s\S]*[.!?]["'”’)]?/)
  return (m ? m[0] : head).trim()
}

export function cleanDescription(
  raw: unknown,
  opts: { source?: CandidateSource } = {},
): CleanResult {
  const removed: DefectCode[] = []
  if (typeof raw !== "string" || !raw.trim()) return { text: "", removed: ["empty"] }

  // 0. bound + normalize line endings before any line-based rule runs
  let s = raw.slice(0, MAX_INPUT_CHARS).replace(/\r\n?/g, "\n").replace(/﻿/g, "")

  // 1. entities (twice, before tag stripping)
  const decoded = decodeEntities(s)
  if (decoded !== s) pushOnce(removed, "entity-residue")
  s = decoded

  // 2. structural HTML — THE fix for run-together words. A block tag must
  //    become whitespace, never the empty string: "therapy.</p><p>American"
  //    collapsed to "therapy.American" under the old stripper.
  if (BLOCK_TAG.test(s) || INLINE_TAG.test(s)) {
    BLOCK_TAG.lastIndex = 0
    INLINE_TAG.lastIndex = 0
    if (/<\s*\/?\s*(?:p|br|div|li)\b/i.test(s)) pushOnce(removed, "word-join")
    pushOnce(removed, "html-tag")
    s = s
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(BLOCK_TAG, "\n")
      .replace(INLINE_TAG, "")
  }

  // 3. link spans — pirate links first, then generic, then bare URLs. Order
  //    matters: stripping a bare URL first would orphan its [label]() wrapper.
  // Subdomain repetition is bounded on BOTH the label and the count: an
  // unbounded (?:[a-z0-9-]+\.)* backtracks catastrophically on a long
  // non-matching string, which adversarial catalogue text can supply.
  const pirateMd = new RegExp(
    `\\[[^\\]\\r\\n]{0,140}\\]\\(\\s*https?://(?:[a-z0-9-]{1,63}\\.){0,4}${PIRATE_HOSTS.source}[a-z]{2,6}[^)\\s]{0,200}\\)`,
    "gi",
  )
  const pirateHit = pirateMd.exec(s)
  if (pirateHit) {
    pushOnce(removed, 'pirate-pdf-link')
    // These sit at the tail, introduced by a fragment like "Download the ...
    // PDF". Cut the whole sentence carrying the link, not just the link, or
    // the fragment is left dangling.
    const head = backToSentenceEnd(s, pirateHit.index)
    const tail = s.slice(pirateHit.index + pirateHit[0].length)
    s = head.length >= DESC_FATAL_FLOOR_CHARS ? head : (head + ' ' + tail).trim()
    pirateMd.lastIndex = 0
    s = s.replace(pirateMd, '')
  }
  const mdLink = /\[([^\]\r\n]{1,150})\]\(\s*(?:https?:)?\/\/[^)\s]+\s*\)/g
  if (mdLink.test(s)) {
    mdLink.lastIndex = 0
    pushOnce(removed, "markdown-link")
    // Keep the human-readable label, drop the URL — unless the label is itself
    // a download/format pitch, in which case drop the whole thing.
    s = s.replace(mdLink, (_m, label: string) =>
      /\b(?:pdf|epub|mobi|download|free read)\b/i.test(label) ? "" : label,
    )
  }
  const footnote = /^[ \t]{0,4}\[\d{1,2}\]:[ \t]*\S.*$/gm
  const footRef = /\[(?:source|[^\]\r\n]{1,60})\]\[\d{1,2}\]/gi
  if (footnote.test(s) || footRef.test(s)) {
    footnote.lastIndex = 0
    footRef.lastIndex = 0
    pushOnce(removed, "markdown-footnote")
    s = s.replace(footnote, "").replace(footRef, "")
  }
  const bareUrl = /(?:https?:\/\/|www\.)[^\s)\]<>"']+/gi
  if (bareUrl.test(s)) {
    bareUrl.lastIndex = 0
    pushOnce(removed, "bare-url")
    s = s.replace(bareUrl, "")
  }
  const email = /[\w.+-]+@[\w-]+\.[a-z]{2,}/gi
  if (email.test(s)) {
    email.lastIndex = 0
    pushOnce(removed, "email")
    s = s.replace(email, "")
  }
  // repair the wreckage links leave behind
  s = s.replace(/\(\s*\)/g, "").replace(/\[\s*\]/g, "").replace(/\s+([,.;:!?])/g, "$1")

  // 4. truncation markers — cut at the earliest, back up to a sentence end
  let cutAt = -1
  for (const [code, re] of CUT_MARKERS) {
    const m = re.exec(s)
    if (m && m.index >= 0 && (cutAt < 0 || m.index < cutAt)) {
      cutAt = m.index
      pushOnce(removed, code)
    }
  }
  if (cutAt >= 0) {
    const candidate = backToSentenceEnd(s, cutAt)
    // A cut that guts the text is worse than the junk: let the scorer reject
    // the whole candidate instead of shipping a stub.
    if (candidate.length >= DESC_FATAL_FLOOR_CHARS) s = candidate
  }

  // 5. line-level junk, head and tail only (never load-bearing prose)
  let lines = s.split("\n").map(l => l.trim()).filter(Boolean)
  const isJunkLine = (line: string): DefectCode | null => {
    for (const [code, re] of LINE_JUNK) {
      if (code === "all-caps-shouting") {
        // Only a genuine multi-word shout, not a stylised one-word opener.
        if (re.test(line) && line.split(/\s+/).length >= 4) return code
      } else if (re.test(line)) return code
    }
    return null
  }
  for (let guard = 0; guard < 12 && lines.length > 1; guard++) {
    const headCode = isJunkLine(lines[0])
    const tailCode = isJunkLine(lines[lines.length - 1])
    if (!headCode && !tailCode) break
    const remaining = lines
      .slice(headCode ? 1 : 0, tailCode ? lines.length - 1 : lines.length)
      .join(" ")
    if (remaining.length < DESC_FATAL_FLOOR_CHARS) break
    if (headCode) {
      pushOnce(removed, headCode)
      lines = lines.slice(1)
    }
    if (tailCode && lines.length > 1) {
      pushOnce(removed, tailCode)
      lines = lines.slice(0, -1)
    }
  }
  s = lines.join("\n")

  // 6. sentence-level marketing
  const sentences = splitSentences(s)
  if (sentences.length > 1) {
    const kept = sentences.filter(sent => {
      for (const [code, re] of SENTENCE_JUNK) {
        if (re.test(sent)) {
          pushOnce(removed, code)
          return false
        }
      }
      return true
    })
    const rebuilt = kept.join(" ").trim()
    if (rebuilt.length >= DESC_FATAL_FLOOR_CHARS) s = rebuilt
  }

  // 7. inline markdown + leftover glyphs
  if (/(\*\*|__)(?=\S)/.test(s) || /(?<![*\w])\*(?=\S)[^*\n]+\*/.test(s)) {
    pushOnce(removed, "markdown-emphasis")
  }
  s = s
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(?<![*\w])\*(?=\S)([^*\n]+?)\*(?!\*)/g, "$1")
    .replace(/(?<![_\w])_(?=\S)([^_\n]+?)_(?!\w)/g, "$1")
  if (/^[ \t]{0,3}[-*+][ \t]+/m.test(s)) {
    pushOnce(removed, "markdown-list-item")
    s = s.replace(/^[ \t]{0,3}[-*+][ \t]+/gm, "")
  }
  if (/[•●∙]/.test(s)) {
    pushOnce(removed, "bullet-glyph-list")
    s = s.replace(/[ \t]*[•●∙][ \t]*/g, ". ")
  }

  // 8. whitespace + punctuation normalization
  if (/[   ​]/.test(s)) pushOnce(removed, "exotic-space")
  s = s
    .replace(/[   ]/g, " ")
    .replace(/​/g, "")
    .replace(/\n{2,}/g, "\n")
    .replace(/\n/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
  // Quote handling, in this order: collapse a doubled terminal quote to one,
  // THEN unwrap a quote spanning the whole text, THEN drop a stray opener.
  // Collapsing first would destroy the closing quote the unwrap needs to match.
  if (/["”“]{2,}\s*$/.test(s)) {
    pushOnce(removed, "doubled-quote-mark")
    s = s.replace(/(["”“])["”“]+\s*$/, "$1").trim()
  }
  if (/^["“][\s\S]+["”]$/.test(s)) {
    s = s.slice(1, -1).trim()
  } else if (/^["“]/.test(s) && !/["”]\s*$/.test(s)) {
    s = s.slice(1).trim()
  }

  return { text: s, removed }
}

/* ── sentences ────────────────────────────────────────────────────────── */

const ABBREV = /(?:^|\s)(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|Mt|vs|etc|approx|Inc|Ltd|Co|No|Vol|pp|ed|trans|[A-Z])\.$/

/** Split on sentence terminators, holding back common abbreviations and
 *  initials so "Ursula K. Le Guin" or "Dr. Manette" never splits. */
export function splitSentences(text: string): string[] {
  const out: string[] = []
  let buf = ""
  const parts = text.split(/(?<=[.!?]["'”’)]?)\s+/)
  for (const part of parts) {
    buf = buf ? `${buf} ${part}` : part
    if (ABBREV.test(buf)) continue
    out.push(buf.trim())
    buf = ""
  }
  if (buf.trim()) out.push(buf.trim())
  return out.filter(Boolean)
}

/** Cut to the band on a SENTENCE boundary — never mid-word, never a bare
 *  ellipsis mid-clause. Keeps whole sentences while they fit. */
export function trimToSentenceBand(
  text: string,
  opts: { maxChars?: number; minChars?: number; idealChars?: number } = {},
): TrimResult {
  const maxChars = opts.maxChars ?? DESC_MAX_CHARS
  const minChars = opts.minChars ?? DESC_MIN_CHARS
  const clean = text.trim()
  if (clean.length <= maxChars) {
    return { text: clean, truncated: false, fitsBand: clean.length >= minChars }
  }
  const sentences = splitSentences(clean)
  let acc = ""
  for (const sentence of sentences) {
    const next = acc ? `${acc} ${sentence}` : sentence
    if (next.length > maxChars) break
    acc = next
  }

  // The greedy prefix can land UNDER the floor when a long sentence follows a
  // short hook. Real case: Atomic Habits opens with an 86-char hook followed by
  // a 229-char sentence — the pair is 315 against a 300 ceiling, so the loop
  // kept only the hook and the whole candidate was then thrown away as
  // too-short, leaving the book with no description at all.
  //
  // So when the prefix is too short, search the windows of consecutive
  // sentences for the one that best fits the band. Earlier windows win ties, so
  // the natural opening is preserved whenever it can be; dropping the hook is a
  // last resort, not a preference.
  if (acc.length < minChars && sentences.length > 1) {
    const ideal = opts.idealChars ?? DESC_IDEAL_CHARS
    let best: { text: string; delta: number } | null = null
    for (let i = 0; i < sentences.length; i++) {
      let window = ""
      for (let j = i; j < sentences.length; j++) {
        const next = window ? `${window} ${sentences[j]}` : sentences[j]
        if (next.length > maxChars) break
        window = next
        if (window.length >= minChars) {
          const delta = Math.abs(window.length - ideal)
          if (!best || delta < best.delta) best = { text: window, delta }
        }
      }
    }
    if (best) acc = best.text
  }

  // A single opening sentence longer than the band: cut at the last clause
  // break that fits so the result still ends on punctuation; failing that,
  // cut on a word boundary with an ellipsis. Never return empty here — an
  // over-long first sentence is common in publisher copy, and returning ""
  // would silently drop an otherwise usable candidate.
  if (!acc) {
    const head = clean.slice(0, maxChars)
    const brk = Math.max(head.lastIndexOf("; "), head.lastIndexOf(", "), head.lastIndexOf(" — "))
    if (brk > minChars) {
      acc = head.slice(0, brk) + "."
    } else {
      const word = head.lastIndexOf(" ")
      acc = word > minChars ? head.slice(0, word).replace(/[,;:—-]$/, "") + "…" : ""
    }
  }
  return {
    text: acc,
    truncated: acc.length < clean.length,
    fitsBand: acc.length >= minChars && acc.length <= maxChars,
  }
}

/* ── scoring ──────────────────────────────────────────────────────────── */

const WIKI_LEDE =
  /^\s*(?:["“]?[A-Z][\w'’:,. -]{1,80}["”]?)\s+is\s+(?:an?|the)\s+(?:\d{4}\s+)?(?:novel|book|work|memoir|play|poem|collection|non-?fiction|short story)\b/i
const ENCYCLOPEDIC =
  /\b(?:was (?:first )?published (?:in|by)|first published in \d{4}|is a \d{4} (?:novel|book)|serialized in|translated (?:in|into) \d+ languages)\b/i
const FOREIGN_HINT =
  /\b(?:der|die|das|und|nicht|eine|ist|roman|el|la|los|las|una|del|que|con|para|le|les|des|une|dans|pour|avec|il|di|che|per|una)\b/gi

/** Mechanical 0-100 quality judgement. No LLM. `phase: "source"` judges a
 *  cleaned, untrimmed candidate and may disqualify it outright; `"output"`
 *  judges the final string and enforces band/ending rules. */
export function scoreDescription(
  text: string,
  ctx: { source?: CandidateSource; title?: string; author?: string; phase?: "source" | "output" } = {},
): ScoreResult {
  const phase = ctx.phase ?? "output"
  const fatal: DefectCode[] = []
  const disqualifying: DefectCode[] = []
  const penalties: DefectCode[] = []
  const t = text.trim()

  // fatal — nothing may ever reach a user carrying these
  if (!t) fatal.push("empty")
  if (PLACEHOLDER_DESCRIPTIONS.includes(t)) fatal.push("placeholder")
  if (/\[[^\]\n]{0,120}\]\(\s*(?:https?:)?\/\/[^)\s]+\s*\)/i.test(t)) fatal.push("markdown-link")
  if (/(?:https?:\/\/|www\.)[^\s)]+/i.test(t)) fatal.push("bare-url")
  if (/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(t)) fatal.push("email")
  if (/<\/?[a-z][a-z0-9-]*(?:\s[^<>]*)?\/?>/i.test(t)) fatal.push("html-tag")
  if (t.length > 0 && t.length < DESC_FATAL_FLOOR_CHARS) fatal.push("too-short")

  // disqualifying — the wrong genre of writing; no cleaner repairs it
  if (phase === "source") {
    if (t.length < SOURCE_MIN_CHARS) disqualifying.push("too-short")
    if (WIKI_LEDE.test(t)) disqualifying.push("wikipedia-lede")
    if (/^["“][\s\S]{100,}["”]\s*$/.test(t)) disqualifying.push("review-quote-wrapper")
    const foreign = t.match(FOREIGN_HINT)
    const words = t.split(/\s+/).length
    if (foreign && words > 0 && foreign.length / words > 0.18) {
      disqualifying.push("edition-format-boilerplate")
    }
  }

  // penalties
  const penalize = (code: DefectCode, points: number) => {
    penalties.push(code)
    return points
  }
  let deduction = 0
  if (ENCYCLOPEDIC.test(t)) deduction += penalize("wikipedia-lede", 18)
  if (/["“][^"“”]{25,}["”]\s*[-–—]{1,2}\s*[A-Z]/.test(t)) {
    deduction += penalize("review-quote-attribution", 15)
  }
  if (/\b[A-Z]{4,}(\s+[A-Z]{2,}){2,}/.test(t)) deduction += penalize("all-caps-shouting", 10)
  if (/[•●∙]/.test(t)) deduction += penalize("bullet-glyph-list", 12)
  if (/[a-z][A-Z]/.test(t.replace(/\b[A-Z]/g, ""))) deduction += penalize("word-join", 20)
  if (/\.{3,}\s*$/.test(t)) deduction += penalize("midword-truncation", 12)
  if (t && !/[.!?]["'”’)]?$/.test(t)) deduction += penalize("no-terminal-punctuation", 8)

  if (phase === "output") {
    if (t.length > DESC_MAX_CHARS) deduction += penalize("too-long", 25)
    if (t.length < DESC_MIN_CHARS) deduction += penalize("too-short", 20)
    const first = splitSentences(t)[0] ?? ""
    if (first.length > 180) deduction += penalize("too-long", 8)
  }

  const score = fatal.length || disqualifying.length ? 0 : Math.max(0, Math.min(100, 100 - deduction))
  return { score, fatal, disqualifying, penalties }
}

/* ── selection ────────────────────────────────────────────────────────── */

export interface DescriptionCandidate {
  source: CandidateSource
  raw: string | undefined
}

export type DescriptionChoice =
  | { kind: "accept"; text: string; source: CandidateSource; score: number }
  | { kind: "rewrite"; sourceMaterial: string; bestSource?: CandidateSource; reason: string }

/**
 * Pick the description, or ask for a rewrite. Replaces longest-wins: length is
 * no longer a selector anywhere, and survives only as a tiebreak inside the
 * band. A candidate must be clean, in-band and score >= ACCEPT_SCORE to ship
 * as-is; otherwise the best surviving text becomes source material for the
 * copy desk, which writes to house style.
 */
export function chooseDescription(candidates: DescriptionCandidate[]): DescriptionChoice {
  type Evaluated = {
    source: CandidateSource
    trimmed: string
    cleaned: string
    outScore: number
    accepted: boolean
    removedCount: number
  }
  const evaluated: Evaluated[] = []

  for (const c of candidates) {
    if (!c.raw) continue
    const { text: cleaned, removed } = cleanDescription(c.raw, { source: c.source })
    if (!cleaned) continue
    const srcScore = scoreDescription(cleaned, { source: c.source, phase: "source" })
    const { text: trimmed } = trimToSentenceBand(cleaned)
    const outScore = scoreDescription(trimmed, { source: c.source, phase: "output" })
    evaluated.push({
      source: c.source,
      trimmed,
      cleaned,
      outScore: outScore.score,
      accepted:
        outScore.fatal.length === 0 &&
        srcScore.disqualifying.length === 0 &&
        outScore.score >= ACCEPT_SCORE &&
        trimmed.length >= DESC_MIN_CHARS,
      removedCount: removed.length,
    })
  }

  const winners = evaluated
    .filter(e => e.accepted)
    // Higher score wins; then the less-contaminated original; then the one
    // closest to the ideal length — length as a tiebreak, never a selector.
    .sort(
      (a, b) =>
        b.outScore - a.outScore ||
        a.removedCount - b.removedCount ||
        Math.abs(a.trimmed.length - DESC_IDEAL_CHARS) - Math.abs(b.trimmed.length - DESC_IDEAL_CHARS),
    )
  if (winners.length > 0) {
    const w = winners[0]
    return { kind: "accept", text: w.trimmed, source: w.source, score: w.outScore }
  }

  // Nothing shippable — hand the richest surviving prose to the copy desk.
  const material = evaluated
    .filter(e => e.cleaned.length >= DESC_FATAL_FLOOR_CHARS)
    .sort((a, b) => b.outScore - a.outScore || b.cleaned.length - a.cleaned.length)[0]
  return {
    kind: "rewrite",
    sourceMaterial: material ? material.cleaned.slice(0, LLM_SOURCE_MATERIAL_MAX_CHARS) : "",
    bestSource: material?.source,
    reason: evaluated.length === 0 ? "no-source" : "below-bar",
  }
}

/** Final assertion for anything about to be published, LLM output included. */
export function isPublishable(text: string): boolean {
  const s = scoreDescription(text, { phase: "output" })
  return s.fatal.length === 0 && text.trim().length >= DESC_MIN_CHARS
}
