"use client"

import { type Book } from "./book-data"

export interface BookLink {
  id: string
  name: string
  icon: string
  url: string
  type: "buy" | "borrow" | "preview"
}

function getISBN(book: Book): string | null {
  // Prefer the explicit isbn field from the API
  if (book.isbn) return book.isbn
  // Fallback: ISBN sometimes embedded in Open Library cover URLs
  const olMatch = book.cover?.match(/\/isbn\/(\d{10,13})-/)
  if (olMatch) return olMatch[1]
  const fbMatch = book.coverFallback?.match(/\/isbn\/(\d{10,13})-/)
  if (fbMatch) return fbMatch[1]
  return null
}

function encodeSearch(title: string, author: string): string {
  return encodeURIComponent(`${title} ${author}`)
}

export function getBookLinks(book: Book): BookLink[] {
  const isbn = getISBN(book)
  const search = encodeSearch(book.title, book.author)
  const links: BookLink[] = []

  // Amazon / Kindle
  if (isbn) {
    links.push({
      id: "amazon",
      name: "Amazon / Kindle",
      icon: "shopping-cart",
      url: `https://www.amazon.com/dp/${isbn}`,
      type: "buy",
    })
  } else {
    links.push({
      id: "amazon",
      name: "Amazon / Kindle",
      icon: "shopping-cart",
      url: `https://www.amazon.com/s?k=${search}&i=stripbooks`,
      type: "buy",
    })
  }

  // Google Play Books
  links.push({
    id: "google-play",
    name: "Google Play Books",
    icon: "smartphone",
    url: `https://play.google.com/store/search?q=${search}&c=books`,
    type: "buy",
  })

  // Audible
  links.push({
    id: "audible",
    name: "Audible",
    icon: "headphones",
    url: `https://www.audible.com/search?keywords=${search}`,
    type: "buy",
  })

  // Apple Books (search — Apple uses numeric IDs so direct links aren't possible)
  links.push({
    id: "apple-books",
    name: "Apple Books",
    icon: "book-open",
    url: `https://books.apple.com/us/search?term=${search}`,
    type: "buy",
  })

  // Open Library (free / borrow)
  if (isbn) {
    links.push({
      id: "openlibrary",
      name: "Open Library",
      icon: "library",
      url: `https://openlibrary.org/isbn/${isbn}`,
      type: "borrow",
    })
  } else {
    links.push({
      id: "openlibrary",
      name: "Open Library",
      icon: "library",
      url: `https://openlibrary.org/search?q=${search}`,
      type: "borrow",
    })
  }

  // WorldCat (find in local library)
  links.push({
    id: "worldcat",
    name: "Find in Library",
    icon: "landmark",
    url: isbn
      ? `https://www.worldcat.org/isbn/${isbn}`
      : `https://www.worldcat.org/search?q=${search}`,
    type: "borrow",
  })

  return links
}
