"use client"

import { useState, useEffect } from "react"
import { ExternalLink, Tag, Eye, ShoppingCart, Smartphone, Headphones, BookOpen, Library, Landmark, type LucideIcon } from "lucide-react"
import { Book } from "@/lib/book-data"
import { getBookLinks, type BookLink } from "@/lib/book-links"
import { fetchPriceInfo, type PriceInfo, isOnWatchList, addToWatchList, removeFromWatchList } from "@/lib/price-tracker"

interface WhereToReadProps {
  book: Book
}

// Cache price info so we don't refetch on every book detail view
const priceCache = new Map<string, { info: PriceInfo | null; ts: number }>()
const PRICE_CACHE_TTL = 10 * 60 * 1000 // 10 minutes

const linkIconMap: Record<string, LucideIcon> = {
  "shopping-cart": ShoppingCart,
  smartphone: Smartphone,
  headphones: Headphones,
  "book-open": BookOpen,
  library: Library,
  landmark: Landmark,
}

export function WhereToRead({ book }: WhereToReadProps) {
  const [priceInfo, setPriceInfo] = useState<PriceInfo | null>(null)
  const [loadingPrice, setLoadingPrice] = useState(false)
  const [watching, setWatching] = useState(false)

  const links = getBookLinks(book)
  const buyLinks = links.filter(l => l.type === "buy")
  const borrowLinks = links.filter(l => l.type === "borrow")

  useEffect(() => {
    let cancelled = false
    setWatching(isOnWatchList(book.id))
    setPriceInfo(null)
    setLoadingPrice(false)
    // Fetch price info if book is from Google Books
    if (book.id && !book.id.match(/^\d+$/)) {
      const cached = priceCache.get(book.id)
      if (cached && Date.now() - cached.ts < PRICE_CACHE_TTL) {
        setPriceInfo(cached.info)
        return
      }
      setLoadingPrice(true)
      fetchPriceInfo(book.id).then(info => {
        if (cancelled) return
        priceCache.set(book.id, { info, ts: Date.now() })
        setPriceInfo(info)
        setLoadingPrice(false)
      })
    }
    return () => { cancelled = true }
  }, [book.id])

  const toggleWatch = () => {
    if (watching) {
      removeFromWatchList(book.id)
      setWatching(false)
    } else {
      addToWatchList(book)
      setWatching(true)
    }
  }

  const formatPrice = (price?: { amount: number; currency: string }) => {
    if (!price) return null
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: price.currency,
    }).format(price.amount)
  }

  return (
    <div className="space-y-4">
      {/* Price info */}
      {priceInfo && priceInfo.saleability !== "unknown" && (
        <div className="bg-stone-50 rounded-xl p-3 border border-stone-200/60">
          <div className="flex items-center justify-between">
            <div>
              {priceInfo.saleability === "FREE" ? (
                <span className="text-sm font-bold text-green-600">Free</span>
              ) : priceInfo.saleability === "FOR_SALE" ? (
                <div className="flex items-center gap-2">
                  {priceInfo.retailPrice && (
                    <span className="text-sm font-bold text-stone-900">
                      {formatPrice(priceInfo.retailPrice)}
                    </span>
                  )}
                  {priceInfo.listPrice && priceInfo.retailPrice &&
                    priceInfo.listPrice.amount > priceInfo.retailPrice.amount && (
                    <span className="text-xs text-stone-400 line-through">
                      {formatPrice(priceInfo.listPrice)}
                    </span>
                  )}
                  {priceInfo.isEbook && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">
                      eBook
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-xs text-stone-500">Not available for sale</span>
              )}
            </div>
            <button
              onClick={toggleWatch}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                watching
                  ? "bg-amber-100 text-amber-700 border border-amber-200"
                  : "bg-white text-stone-500 hover:text-stone-700 border border-stone-200"
              }`}
            >
              <Eye className="w-3 h-3" />
              {watching ? "Watching" : "Watch Price"}
            </button>
          </div>
          {priceInfo.buyLink && (
            <a
              href={priceInfo.buyLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs text-amber-700 hover:text-amber-800 font-medium"
            >
              Buy on Google Play <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {loadingPrice && (
        <div className="flex items-center gap-2 text-xs text-stone-400 py-1">
          <div className="w-3 h-3 border border-stone-300 border-t-stone-500 rounded-full animate-spin" />
          Checking price...
        </div>
      )}

      {/* Buy links */}
      <div>
        <h4 className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2">Buy / Download</h4>
        <div className="grid grid-cols-2 gap-1.5">
          {buyLinks.map(link => {
            const LinkIcon = linkIconMap[link.icon]
            return (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-stone-200/80 hover:border-stone-300 hover:bg-stone-50 transition-all group"
              >
                {LinkIcon && <LinkIcon className="w-4 h-4 text-stone-500 group-hover:text-stone-700 flex-shrink-0" />}
                <span className="text-xs font-medium text-stone-700 group-hover:text-stone-900 truncate">{link.name}</span>
                <ExternalLink className="w-3 h-3 text-stone-300 group-hover:text-stone-400 ml-auto flex-shrink-0" />
              </a>
            )
          })}
        </div>
      </div>

      {/* Borrow links */}
      <div>
        <h4 className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2">Borrow / Free</h4>
        <div className="grid grid-cols-2 gap-1.5">
          {borrowLinks.map(link => {
            const LinkIcon = linkIconMap[link.icon]
            return (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-stone-200/80 hover:border-stone-300 hover:bg-stone-50 transition-all group"
              >
                {LinkIcon && <LinkIcon className="w-4 h-4 text-stone-500 group-hover:text-stone-700 flex-shrink-0" />}
                <span className="text-xs font-medium text-stone-700 group-hover:text-stone-900 truncate">{link.name}</span>
                <ExternalLink className="w-3 h-3 text-stone-300 group-hover:text-stone-400 ml-auto flex-shrink-0" />
              </a>
            )
          })}
        </div>
      </div>
    </div>
  )
}
