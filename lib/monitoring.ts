"use client"

// Error monitoring. Inert unless NEXT_PUBLIC_SENTRY_DSN is set.
//
// The Sentry SDK is ~75 kB, so it is loaded with a DYNAMIC import only when a DSN
// is configured. On any build/deploy without a DSN it is never imported, so it
// stays out of the initial bundle entirely (no cost to the common case). We also
// intentionally do NOT wrap next.config with withSentryConfig, keeping build
// config untouched; that trades away source-map upload + server auto-instrumentation
// for the launch-critical 80%: client error + unhandled-rejection capture.

type SentryModule = typeof import("@sentry/nextjs")
let sentry: SentryModule | null = null

export async function initMonitoring(): Promise<void> {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn || sentry) return
  const mod = await import("@sentry/nextjs")
  mod.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENV || "production",
    // Errors only by default — no performance/replay sampling cost.
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  })
  sentry = mod
}

/** Report a caught error. Safe to call whether or not monitoring is configured. */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (!sentry) return
  sentry.captureException(error, context ? { extra: context } : undefined)
}
