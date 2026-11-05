import type { ParsedVideo, Platform } from '../types/index.ts';

const YOUTUBE_PATH_PREFIXES = ['live', 'shorts', 'embed', 'v'];
const TWITCH_RESERVED_PATHS = new Set(['directory', 'search', 'settings', 'subscriptions', 'inventory', 'wallet', 'downloads']);

function extractUrlFromIframe(input: string): string | null {
  const template = document.createElement('template');
  template.innerHTML = input;
  return template.content.querySelector('iframe')?.getAttribute('src') ?? null;
}

function toUrl(input: string): URL | null {
  try {
    return new URL(input);
  } catch {
    try {
      return new URL(`https://${input}`);
    } catch {
      return null;
    }
  }
}

function hostMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function parseYouTube(url: URL): string | null {
  if (hostMatches(url.hostname, 'youtu.be')) {
    return url.pathname.split('/').filter(Boolean)[0] ?? null;
  }
  const fromQuery = url.searchParams.get('v');
  if (fromQuery) return fromQuery;

  const [prefix, id] = url.pathname.split('/').filter(Boolean);
  return prefix && YOUTUBE_PATH_PREFIXES.includes(prefix) && id ? id : null;
}

function parseTwitch(url: URL): string | null {
  const parts = url.pathname.split('/').filter(Boolean);
  if (url.hostname.startsWith('player.')) {
    const video = url.searchParams.get('video')?.replace(/^v/, '');
    return video ? `videos/${video}` : url.searchParams.get('channel');
  }
  if (parts[0] === 'videos' && parts[1]) return `videos/${parts[1]}`;
  if (parts[0] && !TWITCH_RESERVED_PATHS.has(parts[0])) return parts[0].toLowerCase();
  return null;
}

function parseKick(url: URL): string | null {
  const channel = url.pathname.split('/').filter(Boolean)[0];
  return channel ? channel.toLowerCase() : null;
}

export function parseVideoUrl(input: string): ParsedVideo | null {
  let raw = input.trim();
  if (!raw) return null;

  if (raw.toLowerCase().startsWith('<iframe')) {
    const src = extractUrlFromIframe(raw);
    if (!src) return null;
    raw = src;
  }

  const url = toUrl(raw);
  if (!url || !/^https?:$/.test(url.protocol) || !url.hostname.includes('.')) return null;
  const host = url.hostname.toLowerCase();

  if (hostMatches(host, 'youtube.com') || hostMatches(host, 'youtu.be') || hostMatches(host, 'youtube-nocookie.com')) {
    const id = parseYouTube(url);
    return id ? { platform: 'youtube', videoId: id } : null;
  }

  if (hostMatches(host, 'twitch.tv')) {
    const id = parseTwitch(url);
    return id ? { platform: 'twitch', videoId: id } : null;
  }

  if (hostMatches(host, 'kick.com')) {
    const id = parseKick(url);
    return id ? { platform: 'kick', videoId: id } : null;
  }

  return { platform: 'custom', videoId: url.toString() };
}

export const PLATFORM_META: Record<Platform, { name: string; color: string }> = {
  youtube: { name: 'YouTube', color: '#ff0033' },
  twitch: { name: 'Twitch', color: '#9146ff' },
  kick: { name: 'Kick', color: '#53fc18' },
  custom: { name: 'Embed', color: '#8b8b98' },
};

export function getSlotLabel(platform: Platform, videoId: string): string {
  switch (platform) {
    case 'twitch':
      return videoId.startsWith('videos/') ? `VOD ${videoId.slice(7)}` : videoId;
    case 'kick':
      return videoId;
    case 'youtube':
      return videoId;
    case 'custom':
      try {
        return new URL(videoId).hostname.replace(/^www\./, '');
      } catch {
        return 'Custom embed';
      }
  }
}

export function getSourceUrl(platform: Platform, videoId: string): string {
  switch (platform) {
    case 'youtube':
      return `https://www.youtube.com/watch?${new URLSearchParams({ v: videoId })}`;
    case 'twitch':
      return new URL(videoId, 'https://www.twitch.tv/').toString();
    case 'kick':
      return new URL(videoId, 'https://kick.com/').toString();
    case 'custom':
      return videoId;
  }
}
