import { describe, it, expect } from "vitest"
import { parseSeries } from "@/lib/book-facts-shared"

describe("parseSeries", () => {
  it("parses the parenthesized index shape", () => {
    expect(parseSeries("Mistborn (2)")).toEqual({ name: "Mistborn", index: 2 })
  })

  it("parses the hash index shape", () => {
    expect(parseSeries("The Stormlight Archive #3")).toEqual({
      name: "The Stormlight Archive",
      index: 3,
    })
  })

  it("parses the semicolon index shape", () => {
    expect(parseSeries("Dune ; 1")).toEqual({ name: "Dune", index: 1 })
  })

  it("parses Open Library's double-dash shape (-- bk. N)", () => {
    expect(parseSeries("Dune chronicles -- bk. 1")).toEqual({
      name: "Dune chronicles",
      index: 1,
    })
  })

  it("parses the double-dash shape without the dot and with 'book'", () => {
    expect(parseSeries("Dune chronicles -- bk 2")).toEqual({
      name: "Dune chronicles",
      index: 2,
    })
    expect(parseSeries("Earthsea Cycle -- book 4")).toEqual({
      name: "Earthsea Cycle",
      index: 4,
    })
  })

  it("keeps a bare series name with no index", () => {
    expect(parseSeries("Discworld")).toEqual({
      name: "Discworld",
      index: undefined,
    })
  })

  it("rejects non-strings and blank strings", () => {
    expect(parseSeries(undefined)).toBeUndefined()
    expect(parseSeries(42)).toBeUndefined()
    expect(parseSeries("   ")).toBeUndefined()
  })
})
