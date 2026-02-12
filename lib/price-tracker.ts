"use client"

import { type Book } from "./book-data"

const PRICE_WATCH_KEY = "bookswipe_price_watch"

export interface PriceInfo {
  saleability: "FOR_SALE" | "NOT_FOR_SALE" | "FREE" | "unknown"
  listPrice?: { amount: number; currency: string }
  retailPrice?: { amount: number; currency: string }
  isEbook: boolean
  buyLink?: string
}

export interface PriceWatchEntry {
  bookId: string
  bookTitle: string
  lastPrice: number | null
  lastChecked: string
  alertThreshold: number | null
  priceHistory: { price: number | null; date: string }[]
}

export function getPriceWatchList(): PriceWatchEntry[] {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(PRICE_WATCH_KEY)
    return stored ? JSON.parse(stored) : []
  }
  return []
}

function savePriceWatchList(list: PriceWatchEntry[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(PRICE_WATCH_KEY, JSON.stringify(list))
  }
}

export function addToWatchList(book: Book): void {
  const list = getPriceWatchList()
  if (list.some(e => e.bookId === book.id)) return
  list.push({
    bookId: book.id,
    bookTitle: book.title,
    lastPrice: null,
    lastChecked: "",
    alertThreshold: null,
    priceHistory: [],
  })
  savePriceWatchList(list)
}

export function removeFromWatchList(bookId: string): void {
  const list = getPriceWatchList().filter(e => e.bookId !== bookId)
  savePriceWatchList(list)
}

export function isOnWatchList(bookId: string): boolean {
  return getPriceWatchList().some(e => e.bookId === bookId)
}

export function updateWatchPrice(bookId: string, price: number | null): { dropped: boolean; oldPrice: number | null } {
  const list = getPriceWatchList()
  const entry = list.find(e => e.bookId === bookId)
  if (!entry) return { dropped: false, oldPrice: null }

  const oldPrice = entry.lastPrice
  const today = new Date().toISOString().split("T")[0]

  entry.priceHistory.push({ price, date: today })
  // Keep only last 30 entries
  if (entry.priceHistory.length > 30) {
    entry.priceHistory = entry.priceHistory.slice(-30)
  }
  entry.lastPrice = price
  entry.lastChecked = new Date().toISOString()

  savePriceWatchList(list)

  const dropped = oldPrice !== null && price !== null && price < oldPrice
  return { dropped, oldPrice }
}

export async function fetchPriceInfo(googleBookId: string): Promise<PriceInfo | null> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY
    const url = apiKey
      ? `https://www.googleapis.com/books/v1/volumes/${googleBookId}?key=${apiKey}`
      : `https://www.googleapis.com/books/v1/volumes/${googleBookId}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()

    const saleInfo = data.saleInfo || {}
    const accessInfo = data.accessInfo || {}

    return {
      saleability: saleInfo.saleability || "unknown",
      listPrice: saleInfo.listPrice
        ? { amount: saleInfo.listPrice.amount, currency: saleInfo.listPrice.currencyCode }
        : undefined,
      retailPrice: saleInfo.retailPrice
        ? { amount: saleInfo.retailPrice.amount, currency: saleInfo.retailPrice.currencyCode }
        : undefined,
      isEbook: saleInfo.isEbook || false,
      buyLink: saleInfo.buyLink,
    }
  } catch {
    return null
  }
}
