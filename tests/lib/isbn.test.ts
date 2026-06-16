import { describe, it, expect } from "vitest"
import { toIsbn10 } from "@/lib/isbn"

describe("toIsbn10", () => {
  it("converts a 978-prefixed ISBN-13 to ISBN-10 (computes check digit)", () => {
    // The Midnight Library — ISBN-13 9780525559474 -> ISBN-10 0525559477
    expect(toIsbn10("9780525559474")).toBe("0525559477")
    // Dune — ISBN-13 9780441013593 -> ISBN-10 0441013597
    expect(toIsbn10("9780441013593")).toBe("0441013597")
  })

  it("computes an 'X' check digit when the remainder is 10", () => {
    // Synthetic: core "000000006" -> sum 54, 54 % 11 = 10 -> 'X'.
    // (13th digit is the EAN check digit, which conversion ignores.)
    expect(toIsbn10("9780000000069")).toBe("000000006X")
  })

  it("normalizes a valid-shape ISBN-10 unchanged (uppercased X)", () => {
    expect(toIsbn10("0525559477")).toBe("0525559477")
    expect(toIsbn10("123456789x")).toBe("123456789X")
  })

  it("strips hyphens and surrounding whitespace", () => {
    expect(toIsbn10("978-0-525-55947-4")).toBe("0525559477")
    expect(toIsbn10("  9780525559474  ")).toBe("0525559477")
  })

  it("returns null for 979-prefixed ISBN-13 (no ISBN-10 equivalent exists)", () => {
    expect(toIsbn10("9791234567896")).toBeNull()
  })

  it("returns null for empty, undefined, malformed, or wrong-length input", () => {
    expect(toIsbn10("")).toBeNull()
    expect(toIsbn10(undefined)).toBeNull()
    expect(toIsbn10("not-an-isbn")).toBeNull()
    expect(toIsbn10("12345")).toBeNull()
    expect(toIsbn10("97805255594740000")).toBeNull()
  })
})
