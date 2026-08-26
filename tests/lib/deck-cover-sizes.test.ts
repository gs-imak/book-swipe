import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { DECK_COVER_SIZES } from "@/lib/config"

/**
 * The deck card and its look-ahead preload must resolve to the SAME optimized
 * image URL. When they drifted apart (card `264px, 312px` vs preload
 * `100vw, 400px`) next/image requested w=640 for the card and w=828 for the
 * preload, so every preload warmed a URL the card never asked for and every
 * cover the user reached was downloaded twice.
 *
 * Nothing catches that: both values are valid strings, the types are identical,
 * and the UI looks correct. So the guard is that both call sites reference the
 * shared constant rather than a literal.
 */
const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8")

describe("deck cover sizes", () => {
  it("is a non-empty sizes attribute", () => {
    expect(DECK_COVER_SIZES).toMatch(/\d+px/)
  })

  it("is used by the card, not a literal", () => {
    const card = read("components/book-card.tsx")
    expect(card).toContain("sizes={DECK_COVER_SIZES}")
  })

  it("is used by the look-ahead preload, not a literal", () => {
    const deck = read("components/swipe-interface.tsx")
    expect(deck).toContain("sizes={DECK_COVER_SIZES}")
  })

  it("does not eagerly load the offscreen preloads", () => {
    const deck = read("components/swipe-interface.tsx")
    const preloadBlock = deck.slice(deck.indexOf("Look-ahead cover preload"))
    const imgTag = preloadBlock.slice(preloadBlock.indexOf("<Image"), preloadBlock.indexOf("/>") + 2)
    expect(imgTag).not.toContain("priority")
  })
})
