/**
 * ISBN normalization helpers.
 *
 * The Amazon cover CDN (m.media-amazon.com/images/P/{id}…) is keyed on
 * ISBN-10 / ASIN — passing an ISBN-13 returns a 1×1 "no image" gif. Most book
 * APIs hand us an ISBN-13, so we convert 978-prefixed ISBN-13s back to ISBN-10
 * to unlock the high-resolution, correct-edition cover.
 */

/** Strip hyphens/whitespace and uppercase (for the 'X' check digit). */
function clean(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase()
}

/**
 * Return the ISBN-10 form of an ISBN-10 or 978-prefixed ISBN-13, or null when
 * no ISBN-10 exists (979-prefixed ISBN-13) or the input isn't ISBN-shaped.
 *
 * ISBN-10 inputs are only shape-normalized, not checksum-validated: a slightly
 * wrong id just 404s on the CDN and the caller falls back to the next source.
 */
export function toIsbn10(isbn: string | undefined | null): string | null {
  if (!isbn) return null
  const s = clean(isbn)

  // Already ISBN-10 shaped: 9 digits + a final digit or 'X'.
  if (/^\d{9}[\dX]$/.test(s)) return s

  // ISBN-13: only the 978 prefix has an ISBN-10 equivalent.
  if (/^\d{13}$/.test(s) && s.startsWith("978")) {
    const core = s.slice(3, 12) // 9 significant digits
    // ISBN-10 check digit: c ≡ Σ (i · dᵢ) (mod 11), i = 1..9; 10 → 'X'.
    let sum = 0
    for (let i = 0; i < 9; i++) sum += (i + 1) * Number(core[i])
    const check = sum % 11
    return core + (check === 10 ? "X" : String(check))
  }

  return null
}
