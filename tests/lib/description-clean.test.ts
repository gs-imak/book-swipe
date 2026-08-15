import { describe, it, expect } from "vitest"
import {
  cleanDescription,
  trimToSentenceBand,
  scoreDescription,
  chooseDescription,
  splitSentences,
  isPublishable,
  DESC_MIN_CHARS,
  DESC_MAX_CHARS,
} from "@/lib/description-clean"

// Inputs below reproduce the SHAPE of each defect class measured in the live
// corpus (62 books, both sources). They are written for this suite rather than
// copied from publisher copy, so the repo carries no third-party text.

const PROSE =
  "A lighthouse keeper finds a boat washed up on the rocks with a living child aboard and a dead man beside her. " +
  "His wife, three years into a silence that started with their second stillbirth, asks him to keep the child. " +
  "The decision holds for four years, until they return to the mainland and meet the woman still waiting on the shore."

describe("cleanDescription — HTML", () => {
  it("keeps a word boundary where a block tag was (the run-together bug)", () => {
    const { text, removed } = cleanDescription(
      "<p>She left therapy in the spring.</p><p>American winters had never suited her.</p>",
    )
    expect(text).toContain("spring. American")
    expect(text).not.toContain("spring.American")
    expect(removed).toContain("html-tag")
  })

  it("removes self-closing and inline tags", () => {
    const { text } = cleanDescription("One line.<br/>Two <i>emphasised</i> words.<br />Three.")
    expect(text).not.toMatch(/<[^>]+>/)
    expect(text).toContain("emphasised")
  })

  it("leaves prose containing comparison operators alone", () => {
    const { text } = cleanDescription(`${PROSE} The ratio held at 5 < 10 > 3 throughout.`)
    expect(text).toContain("5 < 10 > 3")
  })
})

describe("cleanDescription — entities", () => {
  it("decodes named, numeric and hex entities", () => {
    const { text } = cleanDescription("Tom&#39;s caf&eacute; &amp; bar &#x2014; open late.")
    expect(text).toBe("Tom's café & bar — open late.")
  })

  it("resolves double-encoded entities", () => {
    const { text } = cleanDescription("Marlowe&amp;#39;s ghost")
    expect(text).toBe("Marlowe's ghost")
  })

  it("does not mangle a literal ampersand followed by prose", () => {
    const { text } = cleanDescription("Smith & Sons, purveyors of maps.")
    expect(text).toBe("Smith & Sons, purveyors of maps.")
  })
})

describe("cleanDescription — links", () => {
  it("removes a trailing pirated-PDF markdown link and its dangling sentence", () => {
    const { text, removed } = cleanDescription(
      `${PROSE} Download the [Book Title PDF](https://chesserresources.com/doc/book-title-pdf/)`,
    )
    expect(removed).toContain("pirate-pdf-link")
    expect(text).not.toMatch(/chesserresources|\]\(|Download the/)
    expect(text).toContain("waiting on the shore.")
  })

  it("keeps the label of an ordinary markdown link but drops the URL", () => {
    const { text } = cleanDescription(`${PROSE} See [the author's notes](https://example.com/notes).`)
    expect(text).toContain("the author's notes")
    expect(text).not.toContain("example.com")
  })

  it("strips footnote definitions and references", () => {
    const { text } = cleanDescription(`${PROSE}[1]\n\n[1]: https://openlibrary.org/works/OL1W`)
    expect(text).not.toMatch(/https?:|\[1\]:/)
  })

  it("strips bare URLs and emails", () => {
    const { text } = cleanDescription(`${PROSE} More at www.example.org or write to a@b.co.`)
    expect(text).not.toMatch(/www\.|@b\.co/)
  })
})

describe("cleanDescription — markdown and marketing", () => {
  it("unwraps bold and italic emphasis", () => {
    const { text, removed } = cleanDescription(
      `**In time for the anniversary**, a new edition. ${PROSE}`,
    )
    expect(text).not.toContain("**")
    expect(removed).toContain("markdown-emphasis")
  })

  it("drops a leading praise banner line", () => {
    const { text, removed } = cleanDescription(`NEW YORK TIMES BESTSELLER\n${PROSE}`)
    expect(text.startsWith("A lighthouse keeper")).toBe(true)
    expect(removed).toContain("praise-award-banner")
  })

  it("drops a trailing review quote with attribution", () => {
    const { text } = cleanDescription(
      `${PROSE}\n"A novel of extraordinary power and restraint." —The Reviewing Press`,
    )
    expect(text).not.toContain("Reviewing Press")
  })

  it("drops comp-title marketing sentences", () => {
    const { text, removed } = cleanDescription(
      `${PROSE} For readers of every other book you have ever enjoyed.`,
    )
    expect(text).not.toMatch(/For readers of/i)
    expect(removed).toContain("comp-titles-marketing")
  })

  it("truncates at an About the Author boundary", () => {
    const { text } = cleanDescription(`${PROSE} About the Author: she lives in Perth with two dogs.`)
    expect(text).not.toMatch(/About the Author|two dogs/)
  })

  it("truncates at a horizontal rule", () => {
    const { text } = cleanDescription(`${PROSE}\n\n----------\n\nAlso contained in: an omnibus.`)
    expect(text).not.toMatch(/omnibus|-{4}/)
  })

  it("unwraps a quote that surrounds the entire description", () => {
    const { text } = cleanDescription(`"${PROSE}""`)
    expect(text.startsWith('"')).toBe(false)
    expect(text.endsWith('""')).toBe(false)
  })
})

describe("cleanDescription — guards", () => {
  it("returns empty for non-strings and blanks", () => {
    expect(cleanDescription(undefined).text).toBe("")
    expect(cleanDescription("   ").removed).toContain("empty")
  })

  it("does not gut the text when removing junk would leave a stub", () => {
    const { text } = cleanDescription("About the Author: a short note only.")
    expect(text.length).toBeGreaterThan(0)
  })
})

describe("splitSentences", () => {
  it("does not split on initials or common abbreviations", () => {
    expect(splitSentences("Ursula K. Le Guin wrote it. Dr. Ann agreed.")).toHaveLength(2)
  })
})

describe("trimToSentenceBand", () => {
  it("cuts on a sentence boundary, never mid-word", () => {
    const long = `${PROSE} ${PROSE}`
    const { text, truncated } = trimToSentenceBand(long)
    expect(truncated).toBe(true)
    expect(text.length).toBeLessThanOrEqual(DESC_MAX_CHARS)
    expect(text).toMatch(/[.!?]["'”’)]?$/)
  })

  it("leaves an in-band description untouched", () => {
    const short = "A lighthouse keeper finds a boat on the rocks with a living child aboard and a dead man beside her, and his wife asks him to keep her. The decision holds for four years."
    const { text, truncated } = trimToSentenceBand(short)
    expect(truncated).toBe(false)
    expect(text).toBe(short)
  })
})

describe("scoreDescription", () => {
  it("marks residual markup and URLs as fatal", () => {
    expect(scoreDescription(`${PROSE} <b>x</b>`).fatal).toContain("html-tag")
    expect(scoreDescription(`${PROSE} https://a.co`).fatal).toContain("bare-url")
  })

  it("disqualifies a Wikipedia lede at source phase", () => {
    const lede = `A Little Life is a 2015 novel by an American novelist. ${PROSE}`
    expect(scoreDescription(lede, { phase: "source" }).disqualifying).toContain("wikipedia-lede")
  })

  it("disqualifies a review-quote wrapper at source phase", () => {
    const wrapped = `"${PROSE}"`
    expect(scoreDescription(wrapped, { phase: "source" }).disqualifying).toContain(
      "review-quote-wrapper",
    )
  })

  it("penalises out-of-band length at output phase", () => {
    expect(scoreDescription("Too short.", { phase: "output" }).score).toBe(0)
    const long = `${PROSE} ${PROSE}`
    expect(scoreDescription(long, { phase: "output" }).penalties).toContain("too-long")
  })

  it("scores clean in-band prose highly", () => {
    const { text } = trimToSentenceBand(PROSE)
    expect(scoreDescription(text, { phase: "output" }).score).toBeGreaterThanOrEqual(78)
  })
})

describe("chooseDescription", () => {
  it("prefers clean shorter copy over longer contaminated copy (no longest-wins)", () => {
    const choice = chooseDescription([
      { source: "google", raw: PROSE },
      {
        source: "openlibrary",
        raw: `${PROSE} ${PROSE} Download the [PDF](https://libgen.rs/x)`,
      },
    ])
    expect(choice.kind).toBe("accept")
    if (choice.kind === "accept") {
      expect(choice.source).toBe("google")
      expect(choice.text.length).toBeLessThanOrEqual(DESC_MAX_CHARS)
    }
  })

  it("asks for a rewrite when every candidate is the wrong genre of writing", () => {
    const choice = chooseDescription([
      { source: "openlibrary", raw: "Villette is an 1853 novel by Charlotte Brontë. It was published in three volumes and follows a young woman who travels abroad to teach at a boarding school in a fictional city." },
    ])
    expect(choice.kind).toBe("rewrite")
    if (choice.kind === "rewrite") expect(choice.sourceMaterial.length).toBeGreaterThan(0)
  })

  it("asks for a rewrite rather than returning empty when there is no source", () => {
    const choice = chooseDescription([{ source: "google", raw: undefined }])
    expect(choice.kind).toBe("rewrite")
    if (choice.kind === "rewrite") expect(choice.reason).toBe("no-source")
  })

  it("never accepts a candidate carrying a fatal defect", () => {
    const choice = chooseDescription([
      { source: "google", raw: `${PROSE} Visit https://example.com for more.` },
    ])
    if (choice.kind === "accept") {
      expect(isPublishable(choice.text)).toBe(true)
      expect(choice.text).not.toContain("example.com")
    }
  })
})

describe("isPublishable", () => {
  it("rejects anything below the publish floor or carrying markup", () => {
    expect(isPublishable("Short.")).toBe(false)
    expect(isPublishable(`${PROSE}<br>`)).toBe(false)
    expect(isPublishable(trimToSentenceBand(PROSE).text)).toBe(true)
  })

  it("agrees with the band constants", () => {
    const { text } = trimToSentenceBand(PROSE)
    expect(text.length).toBeGreaterThanOrEqual(DESC_MIN_CHARS)
  })
})
