// Pure three.js engine behind the 3D book Showcase (see docs/adr/0004).
// Framework-free by design: React mounts a canvas and calls this handle;
// all geometry, textures, springs and pointer physics live here so the
// component stays thin glue. Technique adapted from the trevornoah.com
// interactive-book pattern (hinged cover boxes + spring physics + drag
// orbit), reimplemented for a single book against BookSwipe's warm palette.
import * as THREE from "three"

export interface ShowcaseBookData {
  title: string
  author: string
  /** Same-origin (or CORS-clean) texture URL, or null for the painted cover. */
  coverUrl: string | null
  /** Stable hue (0-360) used for the painted fallback + spine tint. */
  seedHue: number
}

export interface ShowcaseSceneOptions {
  reducedMotion: boolean
  /** CSS serif family for painted cover/spine text, e.g. resolved --font-serif. */
  serifFamily: string
  /** Fired on a click/tap that hits the backdrop (not the book). */
  onBackdropTap: () => void
}

export interface ShowcaseSceneHandle {
  setBook(data: ShowcaseBookData): void
  /** Entrance: book rises into the detail slot with one full turn. */
  open(): void
  /** Exit turn + drop; onDone fires when the book has left the frame. */
  close(onDone: () => void): void
  setViewport(width: number, height: number, panelTopPx: number | null): void
  dispose(): void
}

/* ------------------------------------------------------------------ */
/* Small physics + canvas utilities                                    */
/* ------------------------------------------------------------------ */

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const TAU = Math.PI * 2

// Critically-damped-ish spring integrated per frame; drives every animated
// scalar so motion stays interruptible (a new target never snaps).
class Spring {
  v: number
  t: number
  vel = 0
  constructor(
    v: number,
    private k = 120,
    private d = 14,
  ) {
    this.v = v
    this.t = v
  }
  set(v: number) {
    this.v = v
    this.t = v
    this.vel = 0
  }
  update(dt: number) {
    const a = this.k * (this.t - this.v) - this.d * this.vel
    this.vel += a * dt
    this.v += this.vel * dt
    return this.v
  }
}

function mkCanvas(w: number, h: number) {
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  return c
}

function ctx2d(c: HTMLCanvasElement) {
  const x = c.getContext("2d")
  if (!x) throw new Error("2d context unavailable")
  return x
}

/* ------------------------------------------------------------------ */
/* Procedural texture painters (BookSwipe warm palette)                */
/* ------------------------------------------------------------------ */

const CREAM = "#F5EFE0"
const ESPRESSO = "#2B2118"

// Word-wraps painted text; canvas has no native multiline fillText.
function wrapText(
  x: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ""
  for (const w of words) {
    const probe = line ? line + " " + w : w
    if (x.measureText(probe).width > maxWidth && line) {
      lines.push(line)
      line = w
    } else {
      line = probe
    }
  }
  if (line) lines.push(line)
  return lines
}

// Painted fallback cover: mirrors the BookCover branded placeholder (seed-hue
// tint + cream serif title) so a texture-less 3D book still looks on-brand.
function paintBrandedCover(
  c: HTMLCanvasElement,
  data: ShowcaseBookData,
  serif: string,
) {
  const x = ctx2d(c)
  const { width: w, height: h } = c
  // Same hue pairing as BookCover's branded placeholder, so the 3D fallback
  // and the flat placeholder read as the same edition.
  const g = x.createLinearGradient(0, 0, w * 0.4, h)
  g.addColorStop(0, `hsl(${data.seedHue}, 45%, 35%)`)
  g.addColorStop(1, `hsl(${(data.seedHue + 38) % 360}, 50%, 22%)`)
  x.fillStyle = g
  x.fillRect(0, 0, w, h)
  // Faint frame, like a classic cloth edition
  x.strokeStyle = "rgba(245,239,224,.35)"
  x.lineWidth = 6
  x.strokeRect(52, 52, w - 104, h - 104)
  x.fillStyle = CREAM
  x.textAlign = "center"
  x.font = `700 ${Math.round(w * 0.088)}px ${serif}`
  const lines = wrapText(x, data.title, w * 0.72).slice(0, 5)
  const lh = w * 0.105
  const ty = h * 0.42 - ((lines.length - 1) * lh) / 2
  lines.forEach((l, i) => x.fillText(l, w / 2, ty + i * lh))
  x.globalAlpha = 0.85
  x.font = `400 ${Math.round(w * 0.042)}px ${serif}`
  x.fillText(data.author, w / 2, h * 0.78)
  x.globalAlpha = 1
}

function paintSpine(
  c: HTMLCanvasElement,
  data: ShowcaseBookData,
  bg: string,
  ink: string,
  serif: string,
) {
  const x = ctx2d(c)
  const { width: w, height: h } = c
  x.fillStyle = bg
  x.fillRect(0, 0, w, h)
  x.save()
  x.translate(w / 2, h / 2)
  x.rotate(Math.PI / 2)
  x.fillStyle = ink
  x.textAlign = "center"
  x.font = `700 44px ${serif}`
  const title =
    data.title.length > 34 ? data.title.slice(0, 33) + "…" : data.title
  x.fillText(title.toUpperCase(), -h * 0.08, 16, h * 0.62)
  x.globalAlpha = 0.8
  x.font = "600 26px Arial"
  x.fillText(data.author.toUpperCase(), h * 0.34, 10, h * 0.24)
  x.globalAlpha = 1
  x.restore()
  // Head/tail bands
  x.fillStyle = ink
  x.globalAlpha = 0.55
  x.fillRect(w / 2 - 26, 88, 52, 3)
  x.fillRect(w / 2 - 26, h - 91, 52, 3)
  x.globalAlpha = 1
}

// Back board: abstract blurb lines + roundel, deliberately non-textual so it
// reads as "a back cover" at any spin speed without competing with the panel.
function paintBack(c: HTMLCanvasElement, bg: string, ink: string) {
  const x = ctx2d(c)
  const { width: w, height: h } = c
  x.fillStyle = bg
  x.fillRect(0, 0, w, h)
  const rgba = (a: number) => {
    x.globalAlpha = a
    x.fillStyle = ink
  }
  rgba(0.5)
  x.fillRect(150, 180, w - 470, 26)
  for (let i = 0; i < 9; i++) {
    rgba(0.18)
    // Deterministic ragged right edge (no Math.random: repaints must match)
    const lw = w - 300 - ((i * 97) % 180)
    x.fillRect(150, 296 + i * 54, i === 8 ? w - 560 : lw, 14)
  }
  rgba(0.45)
  x.beginPath()
  x.arc(180, h - 190, 26, 0, TAU)
  x.fill()
  x.globalAlpha = 1
}

// Striated page-block edge: fine vertical/horizontal paper lines.
function paintStriation(c: HTMLCanvasElement, vertical: boolean) {
  const x = ctx2d(c)
  const s = c.width
  x.fillStyle = "#ece4d2"
  x.fillRect(0, 0, s, s)
  let p = 0
  let seed = 7
  const rnd = () => {
    // Tiny LCG so page edges are stable across repaints
    seed = (seed * 48271) % 2147483647
    return seed / 2147483647
  }
  while (p < s) {
    const w = 1 + rnd() * 2.4
    const tone = rnd()
    x.fillStyle =
      tone < 0.12
        ? "rgba(140,125,95,.5)"
        : tone < 0.5
          ? "rgba(255,255,252,.55)"
          : "rgba(190,178,150,.45)"
    if (vertical) x.fillRect(p, 0, w, s)
    else x.fillRect(0, p, s, w)
    p += w + 0.6 + rnd() * 1.6
  }
  for (let i = 0; i < 2200; i++) {
    x.fillStyle = `rgba(120,108,84,${(rnd() * 0.1).toFixed(3)})`
    x.fillRect(rnd() * s, rnd() * s, 1.2, 1.2)
  }
}

function paintEndpaper(c: HTMLCanvasElement) {
  const x = ctx2d(c)
  const s = c.width
  x.fillStyle = "#f3edde"
  x.fillRect(0, 0, s, s)
  let seed = 13
  const rnd = () => {
    seed = (seed * 48271) % 2147483647
    return seed / 2147483647
  }
  for (let i = 0; i < 1200; i++) {
    x.fillStyle = `rgba(120,105,70,${(0.04 + rnd() * 0.08).toFixed(3)})`
    x.fillRect(rnd() * s, rnd() * s, 1.4, 1.4)
  }
  const g = x.createLinearGradient(0, 0, s, 0)
  g.addColorStop(0, "rgba(0,0,0,.07)")
  g.addColorStop(0.12, "rgba(0,0,0,0)")
  g.addColorStop(0.88, "rgba(0,0,0,0)")
  g.addColorStop(1, "rgba(0,0,0,.07)")
  x.fillStyle = g
  x.fillRect(0, 0, s, s)
}

function paintNoise(c: HTMLCanvasElement, base: number, amp: number) {
  const x = ctx2d(c)
  const s = c.width
  const img = x.createImageData(s, s)
  const d = img.data
  let seed = 29
  const rnd = () => {
    seed = (seed * 48271) % 2147483647
    return seed / 2147483647
  }
  for (let i = 0; i < d.length; i += 4) {
    const v = base + (rnd() - 0.5) * 2 * amp
    d[i] = d[i + 1] = d[i + 2] = v
    d[i + 3] = 255
  }
  x.putImageData(img, 0, 0)
}

// Soft radial blob used as a fake contact shadow against the backdrop.
function paintBlob(c: HTMLCanvasElement) {
  const x = ctx2d(c)
  const s = c.width
  const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, "rgba(0,0,0,.85)")
  g.addColorStop(1, "rgba(0,0,0,0)")
  x.fillStyle = g
  x.fillRect(0, 0, s, s)
}

// Painted studio environment (equirect) — warm cream key light, amber kicker,
// soft rose wash — prefiltered through PMREM for material reflections.
function paintEnvironment(c: HTMLCanvasElement) {
  const x = ctx2d(c)
  const { width: w, height: h } = c
  const g = x.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, "#8a7357")
  g.addColorStop(0.55, "#3a2d20")
  g.addColorStop(1, "#160f09")
  x.fillStyle = g
  x.fillRect(0, 0, w, h)
  const blob = (cx: number, cy: number, r: number, rgb: string, a: number) => {
    const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r)
    rg.addColorStop(0, `rgba(${rgb},${a})`)
    rg.addColorStop(1, `rgba(${rgb},0)`)
    x.fillStyle = rg
    x.beginPath()
    x.arc(cx, cy, r, 0, TAU)
    x.fill()
  }
  blob(140, 66, 95, "255,250,238", 0.95) // cream key
  blob(405, 84, 55, "255,196,120", 0.6) // amber kicker
  blob(256, 150, 120, "245,170,140", 0.24) // rose wash
}

/** Average pixel of a CORS-clean image, for spine/back tinting. */
function sampleDominantColor(img: HTMLImageElement): THREE.Color | null {
  try {
    const c = mkCanvas(24, 24)
    const x = ctx2d(c)
    x.drawImage(img, 0, 0, 24, 24)
    const d = x.getImageData(0, 0, 24, 24).data
    let r = 0
    let g = 0
    let b = 0
    const n = d.length / 4
    for (let i = 0; i < d.length; i += 4) {
      r += d[i]
      g += d[i + 1]
      b += d[i + 2]
    }
    return new THREE.Color(r / n / 255, g / n / 255, b / n / 255)
  } catch {
    // Tainted canvas (texture host without CORS): keep the seed-hue tint.
    return null
  }
}

/* ------------------------------------------------------------------ */
/* Book geometry constants (shared hardcover proportions)              */
/* ------------------------------------------------------------------ */

const W = 1.42 // board width
const H = 2.14 // board height
const T = 0.34 // closed thickness
const CT = 0.032 // single board thickness
const OV = 0.05 // board overhang past the page block
const PAGE_N = 12 // individually hinged top sheets
const PAGE_BN = 6 // hinged rear sheets (visible when the back cover fans)
const BLOCK_D = 0.245
const BLOCK_Z = -0.0205
const PIVOT_Z = T / 2 + CT / 2

export function createShowcaseScene(
  canvas: HTMLCanvasElement,
  opts: ShowcaseSceneOptions,
): ShowcaseSceneHandle {
  const RM = opts.reducedMotion
  const idle = RM ? 0 : 1

  /* ---------------- renderer / scene / camera ---------------- */
  // Throws on WebGL-blocked browsers; the caller catches and falls back to
  // the flat Detail Modal.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  // Held under 1 so cover art keeps its printed saturation under ACES.
  renderer.toneMappingExposure = 0.92
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const ANISO = renderer.capabilities.getMaxAnisotropy()

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100)
  camera.position.set(0, 0.1, 9.6)

  const disposables: { dispose(): void }[] = [renderer]
  function track<Type extends { dispose(): void }>(d: Type): Type {
    disposables.push(d)
    return d
  }

  function canvasTex(c: HTMLCanvasElement, color = true) {
    const t = new THREE.CanvasTexture(c)
    if (color) t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = ANISO
    return track(t)
  }

  /* ---------------- environment + lights ---------------- */
  const envCanvas = mkCanvas(512, 256)
  paintEnvironment(envCanvas)
  const envTex = new THREE.CanvasTexture(envCanvas)
  envTex.mapping = THREE.EquirectangularReflectionMapping
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envRT = pmrem.fromEquirectangular(envTex)
  scene.environment = envRT.texture
  envTex.dispose()
  pmrem.dispose()
  track(envRT)

  // Intensities are ~π× the classic legacy-lighting values (three r155+
  // dropped the legacy scaling); final values tuned against the spec render.
  scene.add(new THREE.HemisphereLight(0xd8c4a4, 0x171009, 1.0))
  const key = new THREE.DirectionalLight(0xfff6e8, 2.6)
  key.position.set(3.5, 5, 6)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.camera.left = -4
  key.shadow.camera.right = 4
  key.shadow.camera.top = 4
  key.shadow.camera.bottom = -4
  key.shadow.camera.near = 1
  key.shadow.camera.far = 20
  key.shadow.bias = -0.0004
  key.shadow.normalBias = 0.02
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xd9c9ff, 0.55)
  fill.position.set(-4, 1, 4)
  scene.add(fill)
  const rim = new THREE.DirectionalLight(0xffb98a, 0.95)
  rim.position.set(-2, 3, -5)
  scene.add(rim)

  const bookRoot = new THREE.Group()
  scene.add(bookRoot)

  /* ---------------- shared static textures/materials ---------------- */
  const laminateC = mkCanvas(256, 256)
  paintNoise(laminateC, 128, 10)
  const laminateBump = track(new THREE.CanvasTexture(laminateC))

  const striVC = mkCanvas(512, 512)
  paintStriation(striVC, true)
  const striV = canvasTex(striVC)
  const striHC = mkCanvas(512, 512)
  paintStriation(striHC, false)
  const striH = canvasTex(striHC)
  const endC = mkCanvas(512, 512)
  paintEndpaper(endC)
  const endpaperTex = canvasTex(endC)
  const blobC = mkCanvas(256, 256)
  paintBlob(blobC)
  const blobTex = track(new THREE.CanvasTexture(blobC))

  function std(o: THREE.MeshStandardMaterialParameters) {
    return track(new THREE.MeshStandardMaterial({ metalness: 0.02, ...o }))
  }

  const paperFlat = std({ color: 0xf2ecdd, roughness: 0.95, envMapIntensity: 0.2 })
  const striMatV = std({
    map: striV,
    bumpMap: striV,
    bumpScale: 0.0025,
    roughness: 0.95,
    envMapIntensity: 0.2,
  })
  const striMatH = std({
    map: striH,
    bumpMap: striH,
    bumpScale: 0.0025,
    roughness: 0.95,
    envMapIntensity: 0.2,
  })
  const endpaperMat = std({ map: endpaperTex, roughness: 0.9, envMapIntensity: 0.25 })
  const pageMats = [0xf4eee0, 0xf1ebdb, 0xf6f0e3].map((c) =>
    std({ color: c, roughness: 0.92, envMapIntensity: 0.22, side: THREE.DoubleSide }),
  )

  const coverGeo = track(new THREE.BoxGeometry(W + OV, H + OV * 2, CT))
  const blockGeo = track(new THREE.BoxGeometry(W - 0.015, H, BLOCK_D))
  const pageGeo = track(new THREE.PlaneGeometry(W - 0.02, H - 0.02))
  const spineGeo = track(new THREE.BoxGeometry(0.028, H + OV * 2, T + CT * 2 + 0.006))
  const hitGeo = track(new THREE.BoxGeometry(1.8, 2.5, 1.15))
  const blobGeo = track(new THREE.PlaneGeometry(1, 1))
  const hitMat = track(new THREE.MeshBasicMaterial({ visible: false }))

  /* ---------------- the (single) book ---------------- */
  const root = new THREE.Group()
  const float = new THREE.Group()
  root.add(float)
  bookRoot.add(root)

  // Per-book canvases are repainted on setBook; textures flagged for update.
  const frontC = mkCanvas(1024, 1536)
  const backC = mkCanvas(1024, 1536)
  const spineC = mkCanvas(220, 1536)
  const frontTex = canvasTex(frontC)
  const backTex = canvasTex(backC)
  const spineTex = canvasTex(spineC)

  const mEdge = std({
    color: 0xe4dcc6,
    bumpMap: laminateBump,
    bumpScale: 0.0035,
    roughness: 0.68,
    envMapIntensity: 0.3,
  })
  const mFront = std({
    map: frontTex,
    bumpMap: laminateBump,
    bumpScale: 0.0035,
    roughness: 0.54,
    envMapIntensity: 0.28,
  })
  const mBack = std({
    map: backTex,
    bumpMap: laminateBump,
    bumpScale: 0.0035,
    roughness: 0.58,
    envMapIntensity: 0.26,
  })
  const mSpine = std({
    map: spineTex,
    bumpMap: laminateBump,
    bumpScale: 0.005,
    roughness: 0.78,
    envMapIntensity: 0.22,
  })

  const backPivot = new THREE.Group()
  backPivot.position.set(-W / 2, 0, -PIVOT_Z)
  const backMesh = new THREE.Mesh(coverGeo, [mEdge, mEdge, mEdge, mEdge, endpaperMat, mBack])
  backMesh.position.x = (W + OV) / 2
  backMesh.castShadow = backMesh.receiveShadow = true
  backPivot.add(backMesh)
  float.add(backPivot)

  const frontPivot = new THREE.Group()
  frontPivot.position.set(-W / 2, 0, PIVOT_Z)
  const frontMesh = new THREE.Mesh(coverGeo, [mEdge, mEdge, mEdge, mEdge, mFront, endpaperMat])
  frontMesh.position.x = (W + OV) / 2
  frontMesh.castShadow = frontMesh.receiveShadow = true
  frontPivot.add(frontMesh)
  float.add(frontPivot)

  const spine = new THREE.Mesh(spineGeo, mSpine)
  spine.position.set(-W / 2 - 0.013, 0, 0)
  spine.castShadow = true
  float.add(spine)

  const block = new THREE.Mesh(blockGeo, [striMatV, paperFlat, striMatH, striMatH, paperFlat, paperFlat])
  block.position.set(-0.0075, 0, BLOCK_Z)
  block.castShadow = block.receiveShadow = true
  float.add(block)

  // Hinged sheets: deterministic jitter so the block reads as real paper.
  let jitterSeed = 3
  const jitter = () => {
    jitterSeed = (jitterSeed * 48271) % 2147483647
    return jitterSeed / 2147483647 - 0.5
  }
  const pages: THREE.Group[] = []
  const pageF: number[] = []
  for (let i = 0; i < PAGE_N; i++) {
    const pp = new THREE.Group()
    pp.position.set(-W / 2 + 0.01, jitter() * 0.006, 0.166 - i * 0.0042)
    const pm = new THREE.Mesh(pageGeo, pageMats[i % 3])
    pm.position.x = (W - 0.02) / 2
    pm.rotation.z = jitter() * 0.006
    pp.add(pm)
    float.add(pp)
    pages.push(pp)
    pageF.push(0.3 * Math.pow(1 - i / PAGE_N, 2.6))
  }
  const pagesB: THREE.Group[] = []
  const pageFB: number[] = []
  for (let i = 0; i < PAGE_BN; i++) {
    const pp = new THREE.Group()
    pp.position.set(-W / 2 + 0.01, jitter() * 0.006, -0.166 + i * 0.0042)
    const pm = new THREE.Mesh(pageGeo, pageMats[i % 3])
    pm.position.x = (W - 0.02) / 2
    pm.rotation.z = jitter() * 0.006
    pp.add(pm)
    float.add(pp)
    pagesB.push(pp)
    pageFB.push(0.3 * Math.pow(1 - i / PAGE_BN, 2.6))
  }

  const blob = new THREE.Mesh(
    blobGeo,
    track(new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: 0.45, depthWrite: false })),
  )
  blob.scale.set(3.1, 3.9, 1)
  blob.position.set(0.1, -0.3, -0.85)
  blob.renderOrder = -5
  root.add(blob)

  const hit = new THREE.Mesh(hitGeo, hitMat)
  float.add(hit)

  /* ---------------- animated state ---------------- */
  const springs = {
    px: new Spring(0, 17, 6.8),
    py: new Spring(0, 17, 6.8),
    pz: new Spring(0, 17, 6.8),
    rx: new Spring(0, 17, 6.8),
    ry: new Spring(0, 17, 6.8),
    rz: new Spring(0, 17, 6.8),
    sc: new Spring(1, 17, 6.8),
    cover: new Spring(0, 90, 12),
    coverB: new Spring(0, 90, 12),
    orbX: new Spring(0, 60, 12),
  }
  const parX = new Spring(0, 60, 10)
  const parY = new Spring(0, 60, 10)

  // Orbit: accumulated Y turn + velocity, with drag/spin/return/idle phases —
  // this is the "turn it with the cursor" behaviour.
  const orb = { y: 0, yv: 0, phase: "idle" as "idle" | "drag" | "spin" | "return", target: 0 }
  const phase = 2.1 // idle-bob phase offset, aesthetic constant
  let slot = { p: [-1.95, 0, 1.1], r: [0.02, -0.52, 0.1], s: 1.26 }
  let mode: "closed" | "open" | "closing" = "closed"
  let currentBook: ShowcaseBookData | null = null
  let loadGeneration = 0
  let isDisposed = false

  /* ---------------- book data / textures ---------------- */
  function repaintBoards(dominant: THREE.Color | null, data: ShowcaseBookData) {
    const base = dominant ?? new THREE.Color().setHSL(data.seedHue / 360, 0.45, 0.34)
    const spineCol = base.clone().multiplyScalar(0.78)
    const lum = base.r * 0.299 + base.g * 0.587 + base.b * 0.114
    const ink = lum > 0.5 ? ESPRESSO : CREAM
    const css = (c: THREE.Color) => `#${c.getHexString()}`
    paintSpine(spineC, data, css(spineCol), ink, opts.serifFamily)
    paintBack(backC, css(base), ink)
    spineTex.needsUpdate = true
    backTex.needsUpdate = true
  }

  function setBook(data: ShowcaseBookData) {
    currentBook = data
    const generation = ++loadGeneration
    paintBrandedCover(frontC, data, opts.serifFamily)
    frontTex.needsUpdate = true
    mFront.map = frontTex
    mFront.needsUpdate = true
    repaintBoards(null, data)

    if (data.coverUrl) {
      const loader = new THREE.TextureLoader()
      loader.setCrossOrigin("anonymous")
      loader.load(
        data.coverUrl,
        (t) => {
          // A stale load (book changed, or scene torn down) must not win.
          if (generation !== loadGeneration || isDisposed) {
            t.dispose()
            return
          }
          t.colorSpace = THREE.SRGBColorSpace
          t.anisotropy = ANISO
          mFront.map = track(t)
          mFront.needsUpdate = true
          const img = t.image
          if (img instanceof HTMLImageElement && currentBook) {
            repaintBoards(sampleDominantColor(img), currentBook)
          }
        },
        undefined,
        () => {
          /* painted cover already in place — nothing to do */
        },
      )
    }
  }

  /* ---------------- layout ---------------- */
  let vw = 1
  let vh = 1
  function setViewport(width: number, height: number, panelTopPx: number | null) {
    vw = Math.max(1, width)
    vh = Math.max(1, height)
    renderer.setSize(vw, vh, false)
    camera.aspect = vw / vh
    camera.updateProjectionMatrix()

    const aspect = vw / vh
    const fit = clamp(aspect / 1.75, 0.56, 1)
    bookRoot.scale.setScalar(fit)
    bookRoot.position.y = -(1 - fit) * 0.55
    const portrait = aspect < 0.85

    if (portrait && panelTopPx !== null) {
      // Center the book between the top chrome and the info sheet. tan(13°)
      // converts pixels to world units at the camera plane (fov 26 / 2).
      const T13 = Math.tan((camera.fov / 2) * (Math.PI / 180))
      const camZ = 9.6
      const zWorld = 0.8 * fit
      const freeTop = vh * 0.1
      const freeBot = Math.max(panelTopPx - vh * 0.035, freeTop + 140)
      const midPx = (freeTop + freeBot) / 2
      const rootY = -(1 - fit) * 0.55
      const yWorld = 0.1 + (1 - (2 * midPx) / vh) * T13 * (camZ - zWorld)
      const availW = (((freeBot - freeTop) * 0.92) / vh) * 2 * T13 * (camZ - zWorld)
      slot = {
        p: [0, (yWorld - rootY) / fit, 0.8],
        r: [-0.02, -0.4, 0.06],
        s: clamp(availW / fit / 2.3, 0.5, 1.15),
      }
    } else {
      slot = { p: [-1.95, 0, 1.1], r: [0.02, -0.52, 0.1], s: 1.26 }
    }
    if (mode === "open") targetSlot()
  }

  function targetSlot() {
    springs.px.t = slot.p[0]
    springs.py.t = slot.p[1]
    springs.pz.t = slot.p[2]
    springs.rx.t = slot.r[0]
    springs.ry.t = slot.r[1]
    springs.rz.t = slot.r[2]
    springs.sc.t = slot.s
  }

  /* ---------------- open / close choreography ---------------- */
  function open() {
    mode = "open"
    if (RM) {
      springs.px.set(slot.p[0])
      springs.py.set(slot.p[1])
      springs.pz.set(slot.p[2])
      springs.rx.set(slot.r[0])
      springs.ry.set(slot.r[1])
      springs.rz.set(slot.r[2])
      springs.sc.set(slot.s)
      orb.y = 0
      orb.yv = 0
      orb.phase = "idle"
      return
    }
    // Rise from below the frame with one full turn that settles face-front.
    springs.px.set(slot.p[0])
    springs.py.set(slot.p[1] - 3.6)
    springs.pz.set(slot.p[2])
    springs.rx.set(slot.r[0])
    springs.ry.set(slot.r[1])
    springs.rz.set(slot.r[2] + 0.3)
    springs.sc.set(slot.s * 0.92)
    orb.y = -TAU
    orb.yv = 3
    orb.phase = "return"
    orb.target = 0
    targetSlot()
  }

  let closeTimer: ReturnType<typeof setTimeout> | null = null
  function close(onDone: () => void) {
    if (mode === "closing") return
    mode = "closing"
    if (!RM) {
      // A nudge upward before the drop reads as a lift-and-release.
      springs.py.vel = 2.4
      springs.py.t = slot.p[1] - 4.6
      orb.target = Math.round(orb.y / TAU) * TAU + TAU
      orb.yv = Math.max(orb.yv, 3)
      orb.phase = "return"
    }
    closeTimer = setTimeout(onDone, RM ? 40 : 520)
  }

  /* ---------------- pointer: drag to turn ---------------- */
  const ray = new THREE.Raycaster()
  const ptr = {
    id: null as number | null,
    down: false,
    moved: 0,
    lastX: 0,
    lastY: 0,
    ndcX: 0,
    ndcY: 0,
    overBook: false,
    downOnBook: false,
  }
  const drag = { dxAcc: 0, dyAcc: 0 }

  function castRay() {
    ray.setFromCamera(new THREE.Vector2(ptr.ndcX, ptr.ndcY), camera)
    ptr.overBook = ray.intersectObject(hit, false).length > 0
  }

  function onPointerDown(e: PointerEvent) {
    if (ptr.id !== null || mode !== "open") return
    ptr.id = e.pointerId
    ptr.lastX = e.clientX
    ptr.lastY = e.clientY
    ptr.ndcX = (e.clientX / vw) * 2 - 1
    ptr.ndcY = -(e.clientY / vh) * 2 + 1
    ptr.moved = 0
    castRay()
    ptr.down = true
    ptr.downOnBook = ptr.overBook
    if (ptr.overBook) {
      drag.dxAcc = 0
      drag.dyAcc = 0
      canvas.setPointerCapture(e.pointerId)
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (ptr.id !== null && e.pointerId !== ptr.id) return
    const dxN = (e.clientX - ptr.lastX) / vw
    const dyN = (e.clientY - ptr.lastY) / vh
    ptr.lastX = e.clientX
    ptr.lastY = e.clientY
    ptr.ndcX = (e.clientX / vw) * 2 - 1
    ptr.ndcY = -(e.clientY / vh) * 2 + 1
    if (ptr.down) {
      ptr.moved += Math.abs(dxN * vw) + Math.abs(dyN * vh)
      if (ptr.downOnBook) {
        drag.dxAcc += dxN
        drag.dyAcc += dyN
      }
    } else {
      castRay()
      canvas.style.cursor = ptr.overBook ? "grab" : "default"
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (ptr.id !== null && e.pointerId !== ptr.id) return
    const wasTap = ptr.down && !ptr.downOnBook && ptr.moved < 14
    ptr.id = null
    ptr.down = false
    ptr.downOnBook = false
    canvas.style.cursor = ptr.overBook ? "grab" : "default"
    // A clean tap on empty backdrop dismisses, mirroring modal conventions.
    if (wasTap && mode === "open") opts.onBackdropTap()
  }

  function onPointerCancel(e: PointerEvent) {
    if (ptr.id !== null && e.pointerId !== ptr.id) return
    ptr.id = null
    ptr.down = false
    ptr.downOnBook = false
  }

  canvas.addEventListener("pointerdown", onPointerDown)
  canvas.addEventListener("pointermove", onPointerMove)
  window.addEventListener("pointerup", onPointerUp)
  window.addEventListener("pointercancel", onPointerCancel)
  canvas.addEventListener("lostpointercapture", onPointerCancel as EventListener)

  /* ---------------- frame loop ---------------- */
  const clock = new THREE.Clock()
  let raf = 0

  function tick() {
    raf = requestAnimationFrame(tick)
    const dt = Math.min(clock.getDelta(), 0.05)
    const t = clock.elapsedTime

    /* orbit phases */
    let activity = 0
    if (mode === "open") {
      if (ptr.down && ptr.downOnBook) {
        const step = drag.dxAcc * 6.5
        drag.dxAcc = 0
        orb.y += step
        orb.yv = clamp(orb.yv * 0.5 + (step / Math.max(dt, 0.001)) * 0.5, -14, 14)
        springs.orbX.t = clamp(springs.orbX.t + drag.dyAcc * 3.2, -0.55, 0.55)
        drag.dyAcc = 0
        orb.phase = "drag"
        canvas.style.cursor = "grabbing"
      } else {
        springs.orbX.t = 0
        if (orb.phase === "drag") {
          orb.phase = Math.abs(orb.yv) > 0.6 ? "spin" : "return"
          if (orb.phase === "return")
            orb.target = Math.round((orb.y + orb.yv * 1.2) / Math.PI) * Math.PI
        }
        if (orb.phase === "spin") {
          orb.yv *= Math.exp(-0.9 * dt)
          orb.y += orb.yv * dt
          if (Math.abs(orb.yv) < 0.5) {
            orb.phase = "return"
            orb.target = Math.round((orb.y + orb.yv * 1.2) / Math.PI) * Math.PI
          }
        } else if (orb.phase === "return") {
          const acc = 16 * (orb.target - orb.y) - 8 * orb.yv
          orb.yv += acc * dt
          orb.y += orb.yv * dt
          if (Math.abs(orb.target - orb.y) < 0.002 && Math.abs(orb.yv) < 0.01) {
            orb.y = orb.target
            orb.yv = 0
            orb.phase = "idle"
          }
        }
      }
      const distRest = Math.abs(orb.y - Math.round(orb.y / TAU) * TAU)
      activity = clamp(Math.abs(orb.yv) * 1.5 + (ptr.downOnBook && ptr.down ? 1 : 0) + distRest * 2, 0, 1)
    } else if (mode === "closing" && orb.phase === "return") {
      const acc = 16 * (orb.target - orb.y) - 8 * orb.yv
      orb.yv += acc * dt
      orb.y += orb.yv * dt
    }
    springs.orbX.update(dt)

    /* cover fan targets: breathing when calm, flung by spin inertia */
    let coverBase = 0
    let coverBBase = 0
    if (mode === "open") {
      coverBase = 0.02 + (0.13 + Math.sin(t * 0.8 + phase) * 0.015 * idle) * (1 - activity)
      const nearestBack = Math.round((orb.y - Math.PI) / TAU) * TAU + Math.PI
      const activityB = clamp(
        Math.abs(orb.yv) * 1.5 + (ptr.downOnBook && ptr.down ? 1 : 0) + Math.abs(orb.y - nearestBack) * 2,
        0,
        1,
      )
      coverBBase = (0.1 + Math.sin(t * 0.8 + phase + 1.7) * 0.012 * idle) * (1 - activityB)
    }
    springs.cover.t = coverBase + clamp(orb.yv * 0.16, 0, 0.75)
    springs.coverB.t = coverBBase + clamp(-orb.yv * 0.16, 0, 0.75)

    for (const s of [
      springs.px,
      springs.py,
      springs.pz,
      springs.rx,
      springs.ry,
      springs.rz,
      springs.sc,
      springs.cover,
      springs.coverB,
    ])
      s.update(dt)

    /* idle bob + compose transforms */
    float.position.y = Math.sin(t * 0.7 + phase) * 0.035 * idle
    float.rotation.z = Math.sin(t * 0.9 + phase * 1.7) * 0.006 * idle
    const sway = mode === "open" ? Math.sin(t * 0.45 + phase) * 0.035 * idle * (1 - activity) : 0
    root.position.set(springs.px.v, springs.py.v, springs.pz.v)
    root.rotation.set(springs.rx.v + springs.orbX.v, springs.ry.v + orb.y + sway, springs.rz.v)
    root.scale.setScalar(Math.max(springs.sc.v, 0.001))

    const ang = Math.max(0, springs.cover.v)
    const angB = Math.max(0, springs.coverB.v)
    frontPivot.rotation.y = -ang
    frontPivot.position.z = PIVOT_Z + ang * 0.022
    backPivot.rotation.y = angB
    backPivot.position.z = -PIVOT_Z - angB * 0.022
    spine.rotation.y = -ang * 0.16 + angB * 0.16
    block.scale.z = 1 - (ang + angB) * 0.05
    block.position.z = BLOCK_Z - ang * 0.006 + angB * 0.006
    for (let i = 0; i < PAGE_N; i++) {
      const flutter = idle * Math.sin(t * 1.15 + phase + i * 0.6) * 0.006 * (1 - i / PAGE_N)
      pages[i].rotation.y = -(ang * pageF[i] + Math.max(0, flutter))
    }
    for (let i = 0; i < PAGE_BN; i++) pagesB[i].rotation.y = angB * pageFB[i]

    /* cursor-follow parallax on the whole stage */
    parX.t = RM ? 0 : ptr.ndcX * 0.02
    parY.t = RM ? 0 : -ptr.ndcY * 0.012
    bookRoot.rotation.y = parX.update(dt)
    bookRoot.rotation.x = parY.update(dt)

    renderer.render(scene, camera)
  }
  tick()

  /* ---------------- teardown ---------------- */
  function dispose() {
    isDisposed = true
    cancelAnimationFrame(raf)
    if (closeTimer) clearTimeout(closeTimer)
    canvas.removeEventListener("pointerdown", onPointerDown)
    canvas.removeEventListener("pointermove", onPointerMove)
    window.removeEventListener("pointerup", onPointerUp)
    window.removeEventListener("pointercancel", onPointerCancel)
    canvas.removeEventListener("lostpointercapture", onPointerCancel as EventListener)
    // Geometries/materials/textures registered at creation; renderer last.
    for (const d of disposables.reverse()) d.dispose()
  }

  return { setBook, open, close, setViewport, dispose }
}
