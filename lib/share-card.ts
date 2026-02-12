"use client"

import { type Book } from "./book-data"
import { type BookReview } from "./storage"

export type ShareTemplate = "clean" | "gradient" | "minimal"

interface ShareCardOptions {
  template: ShareTemplate
  quote?: string
}

const CARD_WIDTH = 1080
const CARD_HEIGHT = 1350

async function loadImageAsBlob(url: string): Promise<HTMLImageElement | null> {
  try {
    const response = await fetch(url, { mode: "cors" })
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(objectUrl)
        resolve(img)
      }
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        resolve(null)
      }
      img.src = objectUrl
    })
  } catch {
    return null
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, maxWidth: number, lineHeight: number, maxLines: number): { lines: string[]; totalHeight: number } {
  const words = text.split(" ")
  const lines: string[] = []
  let currentLine = ""

  words.forEach((word) => {
    const testLine = currentLine ? currentLine + " " + word : word
    const metrics = ctx.measureText(testLine)
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  })
  if (currentLine) lines.push(currentLine)

  const truncated = lines.slice(0, maxLines)
  if (lines.length > maxLines) {
    truncated[maxLines - 1] = truncated[maxLines - 1].replace(/\s+\S*$/, "...")
  }

  return { lines: truncated, totalHeight: truncated.length * lineHeight }
}

function drawStars(ctx: CanvasRenderingContext2D, x: number, y: number, rating: number, size: number, color: string) {
  for (let i = 0; i < 5; i++) {
    const cx = x + i * (size + 8)
    const filled = i < Math.round(rating)
    ctx.fillStyle = filled ? color : "#d4d4d8"
    // Simple star shape
    ctx.beginPath()
    const outerRadius = size / 2
    const innerRadius = outerRadius * 0.4
    for (let j = 0; j < 5; j++) {
      const outerAngle = (j * 72 - 90) * (Math.PI / 180)
      const innerAngle = ((j * 72 + 36) - 90) * (Math.PI / 180)
      if (j === 0) ctx.moveTo(cx + outerRadius * Math.cos(outerAngle), y + outerRadius * Math.sin(outerAngle))
      else ctx.lineTo(cx + outerRadius * Math.cos(outerAngle), y + outerRadius * Math.sin(outerAngle))
      ctx.lineTo(cx + innerRadius * Math.cos(innerAngle), y + innerRadius * Math.sin(innerAngle))
    }
    ctx.closePath()
    ctx.fill()
  }
}

async function renderClean(ctx: CanvasRenderingContext2D, book: Book, review: BookReview | null, coverImg: HTMLImageElement | null, quote?: string) {
  // Warm cream background
  ctx.fillStyle = "#faf7f2"
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  // Subtle top border
  ctx.fillStyle = "#d97706"
  ctx.fillRect(0, 0, CARD_WIDTH, 6)

  let yPos = 100

  // Cover
  if (coverImg) {
    const coverW = 340
    const coverH = 510
    const coverX = (CARD_WIDTH - coverW) / 2
    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.08)"
    roundRect(ctx, coverX + 6, yPos + 6, coverW, coverH, 16)
    ctx.fill()
    // Cover image
    ctx.save()
    roundRect(ctx, coverX, yPos, coverW, coverH, 16)
    ctx.clip()
    ctx.drawImage(coverImg, coverX, yPos, coverW, coverH)
    ctx.restore()
    yPos += coverH + 50
  } else {
    yPos += 60
  }

  // Title
  ctx.fillStyle = "#1c1917"
  ctx.font = "bold 48px Georgia, serif"
  ctx.textAlign = "center"
  const titleWrapped = wrapText(ctx, book.title, CARD_WIDTH / 2, CARD_WIDTH - 160, 58, 2)
  titleWrapped.lines.forEach((line, i) => {
    ctx.fillText(line, CARD_WIDTH / 2, yPos + i * 58)
  })
  yPos += titleWrapped.totalHeight + 16

  // Author
  ctx.fillStyle = "#78716c"
  ctx.font = "32px Georgia, serif"
  ctx.fillText(book.author, CARD_WIDTH / 2, yPos)
  yPos += 50

  // Rating stars
  if (review) {
    drawStars(ctx, CARD_WIDTH / 2 - 72, yPos, review.rating, 28, "#d97706")
    yPos += 50
  }

  // Quote
  if (quote) {
    ctx.fillStyle = "#57534e"
    ctx.font = "italic 28px Georgia, serif"
    const quoteWrapped = wrapText(ctx, `"${quote}"`, CARD_WIDTH / 2, CARD_WIDTH - 200, 38, 3)
    quoteWrapped.lines.forEach((line, i) => {
      ctx.fillText(line, CARD_WIDTH / 2, yPos + i * 38)
    })
    yPos += quoteWrapped.totalHeight + 20
  }

  // Branding
  ctx.fillStyle = "#a8a29e"
  ctx.font = "22px sans-serif"
  ctx.fillText("BookSwipe", CARD_WIDTH / 2, CARD_HEIGHT - 60)
}

async function renderGradient(ctx: CanvasRenderingContext2D, book: Book, review: BookReview | null, coverImg: HTMLImageElement | null, quote?: string) {
  // Gradient background
  const gradient = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT)
  gradient.addColorStop(0, "#fbbf24")
  gradient.addColorStop(0.5, "#f59e0b")
  gradient.addColorStop(1, "#fb7185")
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  // Semi-transparent overlay
  ctx.fillStyle = "rgba(255,255,255,0.15)"
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  let yPos = 100

  // Cover with white border
  if (coverImg) {
    const coverW = 320
    const coverH = 480
    const coverX = (CARD_WIDTH - coverW) / 2
    // White border
    ctx.fillStyle = "rgba(255,255,255,0.9)"
    roundRect(ctx, coverX - 8, yPos - 8, coverW + 16, coverH + 16, 20)
    ctx.fill()
    ctx.save()
    roundRect(ctx, coverX, yPos, coverW, coverH, 14)
    ctx.clip()
    ctx.drawImage(coverImg, coverX, yPos, coverW, coverH)
    ctx.restore()
    yPos += coverH + 50
  } else {
    yPos += 60
  }

  // Title
  ctx.fillStyle = "#ffffff"
  ctx.font = "bold 48px Georgia, serif"
  ctx.textAlign = "center"
  const titleWrapped = wrapText(ctx, book.title, CARD_WIDTH / 2, CARD_WIDTH - 160, 58, 2)
  titleWrapped.lines.forEach((line, i) => {
    ctx.fillText(line, CARD_WIDTH / 2, yPos + i * 58)
  })
  yPos += titleWrapped.totalHeight + 16

  // Author
  ctx.fillStyle = "rgba(255,255,255,0.85)"
  ctx.font = "32px Georgia, serif"
  ctx.fillText(book.author, CARD_WIDTH / 2, yPos)
  yPos += 50

  if (review) {
    drawStars(ctx, CARD_WIDTH / 2 - 72, yPos, review.rating, 28, "#ffffff")
    yPos += 50
  }

  if (quote) {
    ctx.fillStyle = "rgba(255,255,255,0.9)"
    ctx.font = "italic 28px Georgia, serif"
    const quoteWrapped = wrapText(ctx, `"${quote}"`, CARD_WIDTH / 2, CARD_WIDTH - 200, 38, 3)
    quoteWrapped.lines.forEach((line, i) => {
      ctx.fillText(line, CARD_WIDTH / 2, yPos + i * 38)
    })
    yPos += quoteWrapped.totalHeight + 20
  }

  ctx.fillStyle = "rgba(255,255,255,0.6)"
  ctx.font = "22px sans-serif"
  ctx.fillText("BookSwipe", CARD_WIDTH / 2, CARD_HEIGHT - 60)
}

async function renderMinimal(ctx: CanvasRenderingContext2D, book: Book, review: BookReview | null, coverImg: HTMLImageElement | null, quote?: string) {
  // Dark background
  ctx.fillStyle = "#1c1917"
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  let yPos = 120

  if (coverImg) {
    const coverW = 300
    const coverH = 450
    const coverX = (CARD_WIDTH - coverW) / 2
    ctx.save()
    roundRect(ctx, coverX, yPos, coverW, coverH, 14)
    ctx.clip()
    ctx.drawImage(coverImg, coverX, yPos, coverW, coverH)
    ctx.restore()
    yPos += coverH + 60
  } else {
    yPos += 60
  }

  // Title
  ctx.fillStyle = "#fafaf9"
  ctx.font = "bold 46px Georgia, serif"
  ctx.textAlign = "center"
  const titleWrapped = wrapText(ctx, book.title, CARD_WIDTH / 2, CARD_WIDTH - 160, 56, 2)
  titleWrapped.lines.forEach((line, i) => {
    ctx.fillText(line, CARD_WIDTH / 2, yPos + i * 56)
  })
  yPos += titleWrapped.totalHeight + 16

  // Author
  ctx.fillStyle = "#a8a29e"
  ctx.font = "30px Georgia, serif"
  ctx.fillText(book.author, CARD_WIDTH / 2, yPos)
  yPos += 50

  if (review) {
    drawStars(ctx, CARD_WIDTH / 2 - 72, yPos, review.rating, 28, "#fbbf24")
    yPos += 50
  }

  if (quote) {
    ctx.fillStyle = "#d6d3d1"
    ctx.font = "italic 26px Georgia, serif"
    const quoteWrapped = wrapText(ctx, `"${quote}"`, CARD_WIDTH / 2, CARD_WIDTH - 200, 36, 3)
    quoteWrapped.lines.forEach((line, i) => {
      ctx.fillText(line, CARD_WIDTH / 2, yPos + i * 36)
    })
  }

  ctx.fillStyle = "#57534e"
  ctx.font = "22px sans-serif"
  ctx.fillText("BookSwipe", CARD_WIDTH / 2, CARD_HEIGHT - 60)
}

export async function generateShareCard(book: Book, review: BookReview | null, options: ShareCardOptions): Promise<Blob | null> {
  const canvas = document.createElement("canvas")
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  // Load cover image
  const coverImg = await loadImageAsBlob(book.cover)

  switch (options.template) {
    case "clean":
      await renderClean(ctx, book, review, coverImg, options.quote)
      break
    case "gradient":
      await renderGradient(ctx, book, review, coverImg, options.quote)
      break
    case "minimal":
      await renderMinimal(ctx, book, review, coverImg, options.quote)
      break
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png")
  })
}

export async function copyImageToClipboard(blob: Blob): Promise<boolean> {
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": blob })
    ])
    return true
  } catch {
    return false
  }
}

export function downloadImage(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
