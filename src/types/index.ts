export type Platform = 'youtube' | 'twitch' | 'kick' | null;

export interface ParsedVideo {
  platform: Platform;
  videoId: string;
  isLive?: boolean;
}

export interface VideoSlot {
  id: number;
  platform: Platform;
  videoId: string | null;
  playerRef?: any;
}

export interface AudioState {
  activeSlot: number | null;
  muteAll: boolean;
}
