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
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
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

export async function searchGutenberg(
  title: string,
  author: string
): Promise<GutenbergBook | null> {
  const normTitle = normalise(title);
  const cacheKey = `bookswipe_gutenberg_meta_${normTitle.replace(/ /g, "_")}`;

  const cached = getSessionItem(cacheKey);
  if (cached !== null) {
    try {
      return JSON.parse(cached) as GutenbergBook;
    } catch {
      // Fall through to fetch
    }
  }

  // Use the first part (handles "Last, First" format — last name only)
  const normAuthor = normalise(author.split(",")[0]);
  const lastWord = normAuthor.split(" ").filter((w) => w.length > 0).pop() ?? normAuthor;

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
    const res = await fetch(textUrl);
    if (!res.ok) return null;
    raw = await res.text();
  } catch {
    return null;
  }

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
