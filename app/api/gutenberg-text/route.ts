import { NextRequest, NextResponse } from "next/server"

// Allowlisted hosts for the proxied fetch. Project Gutenberg serves book text
// from gutenberg.org and redirects /ebooks/{id}... → /cache/epub/{id}/... on
// the same host, so the final resolved host must still be one of these.
const ALLOWED_HOSTS = new Set(["www.gutenberg.org", "gutenberg.org"])

// Download timeout. Book text/HTML can be large, so allow more headroom than a
// metadata call, but still bound it so a slow/stalled upstream can't hang the
// function to the platform limit.
const FETCH_TIMEOUT = 15_000

function isAllowedHost(rawUrl: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return false
  }
  // Only https + an explicitly allowlisted host. Validating the parsed host
  // (not a string prefix) prevents bypasses like
  // https://gutenberg.org.evil.com/ or https://evil.com/?x=https://gutenberg.org/.
  return parsed.protocol === "https:" && ALLOWED_HOSTS.has(parsed.hostname)
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")

  if (!url || !isAllowedHost(url)) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  try {
    // redirect: "follow" lets Gutenberg's same-host redirects resolve, but a
    // redirect could in principle point off-host (SSRF). We re-validate the
    // FINAL resolved host (res.url) against the allowlist before returning the
    // body, so an off-host redirect is rejected even though it was followed.
    const res = await fetch(url, { redirect: "follow", signal: controller.signal })

    if (res.url && !isAllowedHost(res.url)) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
    }

    if (!res.ok) {
      return NextResponse.json({ error: "Upstream error" }, { status: res.status })
    }

    const text = await res.text()
    return new NextResponse(text, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    })
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json({ error: "Upstream timeout" }, { status: 504 })
    }
    return NextResponse.json({ error: "Failed to fetch book text" }, { status: 502 })
  } finally {
    clearTimeout(timer)
  }
}
