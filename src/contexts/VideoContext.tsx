import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { LayoutMode, Platform, VideoSlot } from '../types/index.ts';

export const SLOT_COUNT = 8;
const STORAGE_KEY = 'twill:session:v1';
const PLATFORMS: Platform[] = ['youtube', 'twitch', 'kick', 'custom'];

export type AddVideoResult =
  | { ok: true; slotId: number }
  | { ok: false; reason: 'full' | 'duplicate'; slotId?: number };

interface VideoContextType {
  slots: VideoSlot[];
  filledCount: number;
  /** Slot whose audio is playing; null means everything is muted. */
  audioSlot: number | null;
  layout: LayoutMode;
  addVideo: (platform: Platform, videoId: string) => AddVideoResult;
  clearSlot: (slotId: number) => void;
  clearAll: () => void;
  toggleSlotAudio: (slotId: number) => void;
  toggleMuteAll: () => void;
  swapSlots: (fromId: number, toId: number) => void;
  setLayout: (layout: LayoutMode) => void;
}

const VideoContext = createContext<VideoContextType | undefined>(undefined);

function emptySlots(): VideoSlot[] {
  return Array.from({ length: SLOT_COUNT }, (_, id) => ({ id, platform: null, videoId: null }));
}

/*
 * The session (slot contents + layout) is persisted to localStorage so a
 * refresh does not wipe a carefully arranged multi-view. Anything that does
 * not validate is dropped rather than trusted.
 */
function loadSession(): { slots: VideoSlot[]; layout: LayoutMode } {
  const fallback = { slots: emptySlots(), layout: 'stage' as LayoutMode };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const data = JSON.parse(raw);
    const slots = emptySlots().map((slot, i) => {
      const saved = Array.isArray(data?.slots) ? data.slots[i] : null;
      const valid = saved && PLATFORMS.includes(saved.platform) && typeof saved.videoId === 'string' && saved.videoId;
      return valid ? { ...slot, platform: saved.platform, videoId: saved.videoId } : slot;
    });
    const layouts: LayoutMode[] = ['stage', 'spotlight', 'theater', 'grid'];
    const layout: LayoutMode = layouts.includes(data?.layout) ? data.layout : 'stage';
    return { slots, layout };
  } catch {
    return fallback;
  }
}

export function VideoProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(loadSession);
  const [slots, setSlots] = useState<VideoSlot[]>(initial.slots);
  const [layout, setLayout] = useState<LayoutMode>(initial.layout);
  const [audioSlot, setAudioSlot] = useState<number | null>(null);
  const lastAudioSlot = useRef<number | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ layout, slots: slots.map(({ platform, videoId }) => ({ platform, videoId })) })
      );
    } catch {
      // Storage unavailable (private mode, quota) - the session just won't persist.
    }
  }, [slots, layout]);

  const addVideo = useCallback(
    (platform: Platform, videoId: string): AddVideoResult => {
      const duplicate = slots.find(s => s.platform === platform && s.videoId === videoId);
      if (duplicate) return { ok: false, reason: 'duplicate', slotId: duplicate.id };
      const empty = slots.find(s => s.platform === null);
      if (!empty) return { ok: false, reason: 'full' };
      setSlots(prev => prev.map(s => (s.id === empty.id ? { ...s, platform, videoId } : s)));
      return { ok: true, slotId: empty.id };
    },
    [slots]
  );

  const clearSlot = useCallback((slotId: number) => {
    setSlots(prev => prev.map(s => (s.id === slotId ? { ...s, platform: null, videoId: null } : s)));
    setAudioSlot(prev => (prev === slotId ? null : prev));
    if (lastAudioSlot.current === slotId) lastAudioSlot.current = null;
  }, []);

  const clearAll = useCallback(() => {
    setSlots(emptySlots());
    setAudioSlot(null);
    lastAudioSlot.current = null;
  }, []);

  const toggleSlotAudio = useCallback((slotId: number) => {
    setAudioSlot(prev => {
      const next = prev === slotId ? null : slotId;
      if (next !== null) lastAudioSlot.current = next;
      return next;
    });
  }, []);

  const toggleMuteAll = useCallback(() => {
    if (audioSlot !== null) {
      setAudioSlot(null);
      return;
    }
    const remembered = lastAudioSlot.current;
    const target = remembered !== null && slots[remembered]?.platform ? remembered : slots.find(s => s.platform)?.id;
    if (target !== undefined) {
      lastAudioSlot.current = target;
      setAudioSlot(target);
    }
  }, [audioSlot, slots]);

  const swapSlots = useCallback((fromId: number, toId: number) => {
    setSlots(prev => {
      const next = [...prev];
      next[fromId] = { ...prev[toId], id: fromId };
      next[toId] = { ...prev[fromId], id: toId };
      return next;
    });
    const remap = (id: number | null) => (id === fromId ? toId : id === toId ? fromId : id);
    setAudioSlot(remap);
    lastAudioSlot.current = remap(lastAudioSlot.current);
  }, []);

  const value = useMemo(
    () => ({
      slots,
      filledCount: slots.filter(s => s.platform).length,
      audioSlot,
      layout,
      addVideo,
      clearSlot,
      clearAll,
      toggleSlotAudio,
      toggleMuteAll,
      swapSlots,
      setLayout,
    }),
    [slots, audioSlot, layout, addVideo, clearSlot, clearAll, toggleSlotAudio, toggleMuteAll, swapSlots]
  );

  return <VideoContext.Provider value={value}>{children}</VideoContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useVideo() {
  const context = useContext(VideoContext);
  if (context === undefined) {
    throw new Error('useVideo must be used within a VideoProvider');
  }
  return context;
}
