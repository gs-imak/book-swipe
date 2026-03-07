export interface GutenbergBook {
  id: number;
  title: string;
  authors: { name: string }[];
  formats: Record<string, string>;
}

interface GutendexResponse {
  count: number;
  results: GutenbergBook[];
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function getSessionItem(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function setSessionItem(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Silently ignore quota errors or SSR errors
  }
}

function getTextPlainUrl(formats: Record<string, string>): string | null {
  const keys = Object.keys(formats);
  // Prefer plain utf-8, then plain charset=utf-8, then any text/plain
  let fallback: string | null = null;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (key.startsWith("text/plain")) {
      if (key.includes("utf-8")) {
        return formats[key];
      }
      if (fallback === null) {
        fallback = formats[key];
      }
    }
  }
  return fallback;
}

function getHtmlUrl(formats: Record<string, string>): string | null {
  const keys = Object.keys(formats);
  let fallback: string | null = null;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (key.startsWith("text/html")) {
      if (key.includes("utf-8")) return formats[key];
      if (fallback === null) fallback = formats[key];
    }
  }
  return fallback;
}

/**
 * Fetch illustration image URLs from the book's HTML version.
 * Returns an ordered array of absolute image URLs.
 */
export async function fetchBookImages(book: GutenbergBook): Promise<string[]> {
  const htmlUrl = getHtmlUrl(book.formats);
  if (!htmlUrl) return [];

  try {
    const proxyUrl = `/api/gutenberg-text?url=${encodeURIComponent(htmlUrl)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) return [];
    const html = await res.text();

    // Gutenberg redirects /ebooks/{id}.html.images → /cache/epub/{id}/pg{id}-images.html
    // Use the cache path as base URL so relative image paths resolve correctly
    const baseUrl = `https://www.gutenberg.org/cache/epub/${book.id}/`;

    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    const images: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = imgRegex.exec(html)) !== null) {
      let src = match[1];
      if (src.length < 5) continue;
      // Resolve relative URLs
      if (!src.startsWith("http")) {
        try {
          src = new URL(src, baseUrl).href;
        } catch {
          continue;
        }
      }
      // Skip tiny tracking pixels, icons, and cover images
      if (src.includes("1x1") || src.includes("pixel")) continue;
      if (src.endsWith("/cover.jpg") || src.endsWith("/cover.png")) continue;
      images.push(src);
    }
    return images;
  } catch {
    return [];
  }
}

export async function searchGutenberg(
  title: string,
  author: string
): Promise<GutenbergBook | null> {
  const normTitle = normalise(title);
  const normAuthor = normalise(author.split(",")[0]);
  const lastWord = normAuthor.split(" ").pop() ?? normAuthor;
  const cacheKey = `bookswipe_gutenberg_meta_${normTitle.replace(/ /g, "_")}_${lastWord}`;

  const cached = getSessionItem(cacheKey);
  if (cached !== null) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed.id === "number" && parsed.formats) {
        return parsed as GutenbergBook;
      }
      // fall through to fetch
    } catch {
      // Fall through to fetch
    }
  }

  let data: GutendexResponse;
  try {
    const url = `https://gutendex.com/books/?search=${encodeURIComponent(title)}&languages=en`;
    const res = await fetch(url);
    if (!res.ok) return null;
    data = (await res.json()) as GutendexResponse;
  } catch {
    return null;
  }

  const candidates = data.results;
  let bestScore = 0;
  let bestCandidate: GutenbergBook | null = null;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];

    // Must have a text/plain format
    if (getTextPlainUrl(candidate.formats) === null) {
      continue;
    }

    const bt = normalise(candidate.title);
    const ba = candidate.authors.map((a) => normalise(a.name)).join(" ");

    let score = 0;

    if (bt === normTitle) {
      score += 4;
    } else if (bt.includes(normTitle) || normTitle.includes(bt)) {
      score += 2;
    }

    if (lastWord.length > 0 && ba.includes(lastWord)) {
      score += 3;
    }

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  if (bestScore >= 2 && bestCandidate !== null) {
    setSessionItem(cacheKey, JSON.stringify(bestCandidate));
    return bestCandidate;
  }

  return null;
}

export async function fetchBookText(book: GutenbergBook): Promise<string | null> {
  const cacheKey = `bookswipe_gutenberg_text_${book.id}`;

  const cached = getSessionItem(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const textUrl = getTextPlainUrl(book.formats);
  if (textUrl === null) return null;

  let raw: string;
  try {
    // Proxy through our API to avoid CORS issues with gutenberg.org
    const proxyUrl = `/api/gutenberg-text?url=${encodeURIComponent(textUrl)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) return null;
    raw = await res.text();
  } catch {
    return null;
  }

  // Normalize line endings: \r\n → \n, stray \r → \n
  raw = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Strip Project Gutenberg header (everything before START line)
  const startPattern = /\*{3}\s*START OF THE PROJECT GUTENBERG[^\n]*\n/i;
  const endPattern = /\*{3}\s*END OF THE PROJECT GUTENBERG[^\n]*/i;

  const startMatch = startPattern.exec(raw);
  if (startMatch !== null) {
    raw = raw.slice(startMatch.index + startMatch[0].length);
  }

  const endMatch = endPattern.exec(raw);
  if (endMatch !== null) {
    raw = raw.slice(0, endMatch.index);
  }

  const text = raw.trim();
  setSessionItem(cacheKey, text);
  return text;
}
