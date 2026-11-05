export type Platform = 'youtube' | 'twitch' | 'kick' | 'custom';

export interface ParsedVideo {
  platform: Platform;
  /**
   * YouTube video id, Twitch channel (or `videos/<id>` for a VOD), Kick
   * channel, or the full embed URL for custom sources.
   */
  videoId: string;
}

export interface VideoSlot {
  id: number;
  platform: Platform | null;
  videoId: string | null;
}

export type LayoutMode = 'stage' | 'spotlight' | 'theater' | 'grid';
