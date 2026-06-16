// Generates the PWA app icons (no image dependency — pure Node zlib PNG encoder).
// Brand: dark charcoal background (--primary, hsl(240 5.9% 10%) ≈ #18181b) with a
// cream "open book" glyph, so the icon is visible on both light and dark home screens.
// Re-run with `node scripts/generate-icons.mjs` after changing the design.
// To use real artwork instead, just drop PNGs of the same names into public/icons/.
import { deflateSync } from "node:zlib"
import { writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons")
mkdirSync(OUT, { recursive: true })

const BG = [24, 24, 27, 255] // #18181b
const CREAM = [250, 247, 240, 255]

// CRC32 (PNG)
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, "ascii")
  const body = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}
function encodePNG(size, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))])
}

// Draw the icon into an RGBA buffer.
function drawIcon(size, { maskable = false } = {}) {
  const px = Buffer.alloc(size * size * 4)
  const set = (x, y, c) => {
    const i = (y * size + x) * 4
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = c[3]
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) set(x, y, BG)

  // Open-book glyph: two pages with a small spine gap. Scaled down for maskable safe zone.
  const scale = maskable ? 0.62 : 0.74
  const cx = size / 2, cy = size / 2
  const pageW = size * 0.30 * (scale / 0.74)
  const pageH = size * 0.30 * (scale / 0.74)
  const gap = size * 0.018
  const r = size * 0.045 // outer corner radius
  const lineW = Math.max(2, size * 0.012)

  const inRoundedRect = (x, y, left, top, right, bottom, roundLeft, roundRight) => {
    if (x < left || x > right || y < top || y > bottom) return false
    // round only the outer corners
    if (roundLeft) {
      if (x < left + r && y < top + r && Math.hypot(x - (left + r), y - (top + r)) > r) return false
      if (x < left + r && y > bottom - r && Math.hypot(x - (left + r), y - (bottom - r)) > r) return false
    }
    if (roundRight) {
      if (x > right - r && y < top + r && Math.hypot(x - (right - r), y - (top + r)) > r) return false
      if (x > right - r && y > bottom - r && Math.hypot(x - (right - r), y - (bottom - r)) > r) return false
    }
    return true
  }

  const top = cy - pageH, bottom = cy + pageH
  const lTextX = cx - gap - pageW + size * 0.05
  const rTextX = cx + gap + size * 0.05
  const textW = pageW - size * 0.085
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const leftPage = inRoundedRect(x, y, cx - gap - pageW, top, cx - gap, bottom, true, false)
      const rightPage = inRoundedRect(x, y, cx + gap, top, cx + gap + pageW, bottom, false, true)
      if (leftPage || rightPage) {
        set(x, y, CREAM)
        // text lines (3 per page)
        for (const ly of [cy - pageH * 0.45, cy, cy + pageH * 0.45]) {
          if (Math.abs(y - ly) <= lineW / 2) {
            if (leftPage && x >= lTextX && x <= lTextX + textW) set(x, y, BG)
            if (rightPage && x >= rTextX && x <= rTextX + textW) set(x, y, BG)
          }
        }
      }
    }
  }
  return px
}

const targets = [
  { name: "icon-192.png", size: 192, maskable: false },
  { name: "icon-512.png", size: 512, maskable: false },
  { name: "icon-512-maskable.png", size: 512, maskable: true },
  { name: "apple-touch-icon.png", size: 180, maskable: false },
]
for (const t of targets) {
  const png = encodePNG(t.size, drawIcon(t.size, { maskable: t.maskable }))
  writeFileSync(join(OUT, t.name), png)
  console.log(`wrote ${t.name} (${t.size}x${t.size}, ${png.length} bytes)`)
}
