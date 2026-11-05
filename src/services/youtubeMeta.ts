/*
 * Channel name + title for YouTube video ids, via YouTube's public oEmbed
 * endpoint (CORS-enabled, no API key or quota). Results are cached in memory
 * and localStorage so each video is looked up once; concurrent requests for
 * the same id share one fetch; failures are not retried for a while.
 */

export interface YouTubeMeta {
  author: string;
  title: string;
}

type Entry = { meta: YouTubeMeta | null; at: number };

const KEY = 'twill:ytmeta:v1';
const MAX_ENTRIES = 300;
const FAILURE_TTL_MS = 60 * 1000;

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();

try {
  const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, YouTubeMeta>;
  for (const [id, meta] of Object.entries(saved)) {
    if (meta && typeof meta.author === 'string') cache.set(id, { meta, at: Date.now() });
  }
} catch {
  // No persisted cache.
}

function persist() {
  try {
    const entries = [...cache.entries()].filter(([, e]) => e.meta).slice(-MAX_ENTRIES);
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(entries.map(([id, e]) => [id, e.meta]))));
  } catch {
    // Storage full or unavailable.
  }
}

async function load(videoId: string) {
  const url = new URL('https://www.youtube.com/oembed');
  url.searchParams.set('url', `https://www.youtube.com/watch?v=${videoId}`);
  url.searchParams.set('format', 'json');
  let meta: YouTubeMeta | null = null;
  try {
    const response = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (response.ok) {
      const data = await response.json();
      const author = typeof data.author_name === 'string' ? data.author_name.trim() : '';
      if (author) meta = { author, title: typeof data.title === 'string' ? data.title : '' };
    }
  } catch {
    // Offline or blocked; fall back to the id.
  }
  cache.set(videoId, { meta, at: Date.now() });
  if (meta) persist();
  listeners.forEach(l => l());
}

export function getYouTubeMeta(videoId: string): YouTubeMeta | null {
  const entry = cache.get(videoId);
  const stale = !entry || (!entry.meta && Date.now() - entry.at > FAILURE_TTL_MS);
  if (stale && !inflight.has(videoId)) {
    const request = load(videoId).finally(() => inflight.delete(videoId));
    inflight.set(videoId, request);
  }
  return entry?.meta ?? null;
}

/** Lets a loaded player supply metadata (fallback when oEmbed failed). */
export function setYouTubeMeta(videoId: string, meta: YouTubeMeta) {
  if (!meta.author || cache.get(videoId)?.meta?.author === meta.author) return;
  cache.set(videoId, { meta, at: Date.now() });
  persist();
  listeners.forEach(l => l());
}

export function subscribeYouTubeMeta(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
