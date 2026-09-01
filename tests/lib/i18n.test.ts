import { describe, it, expect } from "vitest"
import en from "@/lib/i18n/en"
import fr from "@/lib/i18n/fr"
import {
  interpolate,
  isSingularEn,
  isSingularFr,
  translate,
  translatePlural,
} from "@/lib/i18n/translate"

describe("dictionary parity", () => {
  it("translates every English key", () => {
    const missing = Object.keys(en).filter((k) => !(k in fr))
    expect(missing).toEqual([])
  })

  it("carries no key French has and English does not", () => {
    const orphans = Object.keys(fr).filter((k) => !(k in en))
    expect(orphans).toEqual([])
  })

  it("leaves no French value empty", () => {
    const blank = Object.entries(fr).filter(([, v]) => !v || !v.trim())
    expect(blank).toEqual([])
  })

  it("keeps every placeholder the English string declares, and invents none", () => {
    // Compared as SETS, not as lists: French legitimately repeats a hole the
    // English uses once, because agreement lands on the adjective as well as
    // the noun ("{v0} jour{v1} restant{v1}"). What must never happen is a
    // DROPPED hole — a sentence with a gap where the book title should be —
    // or an invented one, which interpolate() would render as literal braces.
    const holes = (s: string) => [...new Set(s.match(/\{\w+\}/g) ?? [])].sort()
    const broken: string[] = []
    for (const [key, value] of Object.entries(en)) {
      const a = holes(value)
      const b = holes(fr[key as keyof typeof fr])
      if (a.join("|") !== b.join("|")) broken.push(`${key}: en=${a} fr=${b}`)
    }
    expect(broken).toEqual([])
  })

  it("uses flat dotted keys, never nested objects", () => {
    // A nesting resolver splits on "." and silently misses any key holding a
    // dot that came from data. Flatness is what makes that impossible here.
    const nested = Object.values(en).filter((v) => typeof v !== "string")
    expect(nested).toEqual([])
  })
})

describe("translate", () => {
  const dict = { hello: "Bonjour", greet: "Bonjour {name}" }
  const fallback = { hello: "Hello", greet: "Hello {name}", only_en: "Only English" }

  it("prefers the active dictionary", () => {
    expect(translate(dict, fallback, "hello")).toBe("Bonjour")
  })

  it("falls back to English rather than rendering nothing", () => {
    expect(translate(dict, fallback, "only_en")).toBe("Only English")
  })

  it("renders the key itself when nothing knows it", () => {
    // Visible in a screenshot beats an empty gap nobody notices.
    expect(translate(dict, fallback, "no.such.key")).toBe("no.such.key")
  })

  it("interpolates named holes", () => {
    expect(translate(dict, fallback, "greet", { name: "Lycia" })).toBe("Bonjour Lycia")
  })
})

describe("interpolate", () => {
  it("leaves an unknown placeholder written out", () => {
    expect(interpolate("Hi {name}", { other: 1 })).toBe("Hi {name}")
  })

  it("renders a nullish value as empty rather than as \"undefined\"", () => {
    expect(interpolate("Hi {name}", { name: undefined })).toBe("Hi ")
  })

  it("accepts numbers", () => {
    expect(interpolate("{n} pp", { n: 496 })).toBe("496 pp")
  })
})

describe("plurals", () => {
  const dict = { book_one: "{count} livre", book_other: "{count} livres" }

  it("English treats only 1 as singular", () => {
    expect(isSingularEn(0)).toBe(false)
    expect(isSingularEn(1)).toBe(true)
    expect(isSingularEn(2)).toBe(false)
  })

  it("French treats 0 as singular too", () => {
    // "0 livre", not "0 livres" — the rule differs from English and is the
    // reason the plural test is a function of the locale.
    expect(isSingularFr(0)).toBe(true)
    expect(isSingularFr(1)).toBe(true)
    expect(isSingularFr(2)).toBe(false)
  })

  it("picks the form by count", () => {
    expect(translatePlural(dict, dict, "book", 0, isSingularFr)).toBe("0 livre")
    expect(translatePlural(dict, dict, "book", 1, isSingularFr)).toBe("1 livre")
    expect(translatePlural(dict, dict, "book", 4, isSingularFr)).toBe("4 livres")
  })

  it("falls back to the bare key when no plural forms exist", () => {
    expect(translatePlural({ book: "{count} book(s)" }, {}, "book", 3, isSingularEn))
      .toBe("3 book(s)")
  })
})
