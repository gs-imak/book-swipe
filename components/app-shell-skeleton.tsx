import { Skeleton, BookCardSkeleton, SwipeCardSkeleton } from "@/components/ui/skeleton"

/**
 * The boot placeholder a returning user sees instead of the landing hero.
 *
 * The hero is server-rendered now (crawlers and first-time visitors need real
 * content at first paint), but a returning user must never see marketing copy
 * before their own library. Rather than branch in React — which cannot happen
 * until hydration, ~3.5s in — the inline script in app/layout.tsx stamps
 * data-app-state on <html> before <body> is parsed, and the mask in
 * globals.css swaps hero for this shell in the very first style resolution.
 *
 * Deliberately has NO text nodes: it must not dilute the indexable copy or
 * look like hidden text to a crawler. No hooks and no storage reads either —
 * useTheme()/useLikedCount() have server snapshots ("light" / 0) that would
 * visibly pop on hydration. Dark styling rides on `dark:` variants, which the
 * boot script's class on <html> already satisfies.
 */
export function AppShellSkeleton({ variant }: { variant?: "deck" | "shelf" }) {
  // Boot mode is hidden by default and revealed only by the mask. Inline mode
  // (a dynamic() loading fallback) is always visible and picks its own shape.
  const inline = variant !== undefined

  return (
    <div
      {...(inline ? {} : { "data-shell": "skeleton" })}
      aria-hidden="true"
      role="presentation"
      className="bg-background flex flex-col"
      style={{ minHeight: "100dvh" }}
    >
      {/* Header — mirrors dashboard-header's px-4 sm:px-6 py-3 sm:py-4 */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 border-b border-border">
        <Skeleton className="w-9 h-9 rounded-xl" />
        <Skeleton className="h-5 w-32 rounded-md" />
        <div className="flex-1" />
        <Skeleton className="w-9 h-9 rounded-full" />
      </div>

      {(!inline || variant === "shelf") && (
        <div
          data-skel="shelf"
          className="px-4 sm:px-6 pt-5 flex-1"
          {...(inline ? { style: { display: "block" } } : {})}
        >
          <div className="flex gap-2 mb-5">
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-16 rounded-full" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <BookCardSkeleton key={i} />
            ))}
          </div>
        </div>
      )}

      {(!inline || variant === "deck") && (
        <div
          data-skel="deck"
          className="flex-1 flex items-center justify-center px-5"
          {...(inline ? { style: { display: "flex" } } : {})}
        >
          <SwipeCardSkeleton />
        </div>
      )}

      {/* Bottom nav — 64px + safe area, matching mobile-nav's own spacer */}
      <div
        className="border-t border-border flex items-center justify-around px-8 lg:hidden"
        style={{ height: "calc(64px + env(safe-area-inset-bottom, 0px))" }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="w-8 h-8 rounded-lg" />
        ))}
      </div>
    </div>
  )
}
