import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")

  if (
    !url ||
    !(url.startsWith("https://www.gutenberg.org/") || url.startsWith("https://gutenberg.org/"))
  ) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
  }

  try {
    const res = await fetch(url, { redirect: "follow" })
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
  } catch {
    return NextResponse.json({ error: "Failed to fetch book text" }, { status: 502 })
  }
}
