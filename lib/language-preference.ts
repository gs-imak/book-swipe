"use client"

import { clearBookCache } from "./book-cache"

const LANGUAGE_KEY = "bookswipe_language"

export type BookLanguage =
  | "en" | "fr" | "es" | "de" | "it" | "pt"
  | "nl" | "ja" | "zh" | "ko" | "ru" | "ar"
  | "all"

export const LANGUAGE_LABELS: Record<BookLanguage, string> = {
  en: "English",
  fr: "Français",
  es: "Español",
  de: "Deutsch",
  it: "Italiano",
  pt: "Português",
  nl: "Nederlands",
  ja: "日本語",
  zh: "中文",
  ko: "한국어",
  ru: "Русский",
  ar: "العربية",
  all: "All Languages",
}

// ISO 639-1 → Open Library 3-letter codes
const ISO_TO_OL: Record<string, string[]> = {
  en: ["eng"],
  fr: ["fre", "fra"],
  es: ["spa"],
  de: ["ger", "deu"],
  it: ["ita"],
  pt: ["por"],
  nl: ["dut", "nld"],
  ja: ["jpn"],
  zh: ["chi", "zho"],
  ko: ["kor"],
  ru: ["rus"],
  ar: ["ara"],
}

export function getLanguagePreference(): BookLanguage {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(LANGUAGE_KEY) as BookLanguage | null
    if (stored && stored in LANGUAGE_LABELS) return stored
  }
  return "en"
}

export function setLanguagePreference(lang: BookLanguage): void {
  if (typeof window === "undefined") return
  const current = getLanguagePreference()
  localStorage.setItem(LANGUAGE_KEY, lang)
  if (current !== lang) {
    clearBookCache()
  }
}

export function getOpenLibraryLanguageCodes(lang?: BookLanguage): string[] | null {
  const resolved = lang ?? getLanguagePreference()
  if (resolved === "all") return null
  return ISO_TO_OL[resolved] ?? null
}
