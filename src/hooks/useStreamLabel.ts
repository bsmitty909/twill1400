import { useSyncExternalStore } from 'react';
import type { Platform } from '../types/index.ts';
import { getSlotLabel } from '../services/urlParser';
import { getYouTubeMeta, subscribeYouTubeMeta } from '../services/youtubeMeta';

/**
 * Human label for a stream. YouTube videos show the creator's channel name
 * (looked up once and cached) instead of the opaque video id.
 */
export function useStreamLabel(platform: Platform, videoId: string): { label: string; title: string | null } {
  const meta = useSyncExternalStore(
    subscribeYouTubeMeta,
    () => (platform === 'youtube' ? getYouTubeMeta(videoId) : null),
    () => null
  );
  if (platform === 'youtube') {
    return { label: meta?.author ?? 'YouTube video', title: meta?.title || null };
  }
  return { label: getSlotLabel(platform, videoId), title: null };
}
