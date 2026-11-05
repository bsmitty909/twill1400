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
  /** Slots currently playing sound (several may mix). */
  audible: number[];
  /** First audible slot, or null when everything is muted. */
  audioSlot: number | null;
  /** Per-slot volume, 0-100. */
  volumes: number[];
  layout: LayoutMode;
  addVideo: (platform: Platform, videoId: string) => AddVideoResult;
  /** Adds several streams in one state update; results line up with input. */
  addVideos: (items: { platform: Platform; videoId: string }[]) => AddVideoResult[];
  /** Replaces every slot (and optionally the layout), e.g. a saved setup. */
  loadSetup: (items: { platform: Platform; videoId: string }[], layout?: LayoutMode) => void;
  clearSlot: (slotId: number) => void;
  clearAll: () => void;
  /** "Listen only to this one": exclusive, used by the 1-8 chips and keys. */
  toggleSlotAudio: (slotId: number) => void;
  /** Mutes/unmutes one slot without touching the others (mixing). */
  toggleSlotMute: (slotId: number) => void;
  setSlotVolume: (slotId: number, volume: number) => void;
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
export const DEFAULT_VOLUME = 80;
const defaultVolumes = () => Array.from({ length: SLOT_COUNT }, () => DEFAULT_VOLUME);

function loadSession(): { slots: VideoSlot[]; layout: LayoutMode; volumes: number[] } {
  const fallback = { slots: emptySlots(), layout: 'stage' as LayoutMode, volumes: defaultVolumes() };
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
    const volumes = defaultVolumes().map((v, i) => {
      const saved = Array.isArray(data?.volumes) ? Number(data.volumes[i]) : NaN;
      return Number.isFinite(saved) ? Math.min(100, Math.max(0, Math.round(saved))) : v;
    });
    return { slots, layout, volumes };
  } catch {
    return fallback;
  }
}

export function VideoProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(loadSession);
  const [slots, setSlots] = useState<VideoSlot[]>(initial.slots);
  const [layout, setLayout] = useState<LayoutMode>(initial.layout);
  const [audible, setAudible] = useState<number[]>([]);
  const [volumes, setVolumes] = useState<number[]>(initial.volumes);
  const lastAudible = useRef<number[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ layout, volumes, slots: slots.map(({ platform, videoId }) => ({ platform, videoId })) })
      );
    } catch {
      // Storage unavailable (private mode, quota) - the session just won't persist.
    }
  }, [slots, layout, volumes]);

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

  const addVideos = useCallback(
    (items: { platform: Platform; videoId: string }[]): AddVideoResult[] => {
      const next = slots.map(s => ({ ...s }));
      const results = items.map((item): AddVideoResult => {
        const duplicate = next.find(s => s.platform === item.platform && s.videoId === item.videoId);
        if (duplicate) return { ok: false, reason: 'duplicate', slotId: duplicate.id };
        const empty = next.find(s => s.platform === null);
        if (!empty) return { ok: false, reason: 'full' };
        empty.platform = item.platform;
        empty.videoId = item.videoId;
        return { ok: true, slotId: empty.id };
      });
      if (results.some(r => r.ok)) setSlots(next);
      return results;
    },
    [slots]
  );

  const loadSetup = useCallback((items: { platform: Platform; videoId: string }[], nextLayout?: LayoutMode) => {
    setSlots(emptySlots().map((slot, i) => (items[i] ? { ...slot, ...items[i] } : slot)));
    if (nextLayout) setLayout(nextLayout);
    setAudible([]);
    lastAudible.current = [];
  }, []);

  const clearSlot = useCallback((slotId: number) => {
    setSlots(prev => prev.map(s => (s.id === slotId ? { ...s, platform: null, videoId: null } : s)));
    setAudible(prev => prev.filter(id => id !== slotId));
    setVolumes(prev => prev.map((v, i) => (i === slotId ? DEFAULT_VOLUME : v)));
    lastAudible.current = lastAudible.current.filter(id => id !== slotId);
  }, []);

  const clearAll = useCallback(() => {
    setSlots(emptySlots());
    setAudible([]);
    setVolumes(defaultVolumes());
    lastAudible.current = [];
  }, []);

  const toggleSlotAudio = useCallback((slotId: number) => {
    setAudible(prev => {
      const next = prev.length === 1 && prev[0] === slotId ? [] : [slotId];
      if (next.length) lastAudible.current = next;
      return next;
    });
  }, []);

  const toggleSlotMute = useCallback((slotId: number) => {
    setAudible(prev => {
      const next = prev.includes(slotId) ? prev.filter(id => id !== slotId) : [...prev, slotId];
      if (next.length) lastAudible.current = next;
      return next;
    });
    // Unmuting a stream whose slider sits at 0 would stay silent; lift it.
    setVolumes(prev => prev.map((v, i) => (i === slotId && v === 0 ? DEFAULT_VOLUME : v)));
  }, []);

  /** Moving a slider is an implicit unmute; dragging it to 0 mutes. */
  const setSlotVolume = useCallback((slotId: number, volume: number) => {
    const level = Math.min(100, Math.max(0, Math.round(volume)));
    setVolumes(prev => prev.map((v, i) => (i === slotId ? level : v)));
    setAudible(prev => {
      const has = prev.includes(slotId);
      if (level === 0 && has) return prev.filter(id => id !== slotId);
      if (level > 0 && !has) {
        const next = [...prev, slotId];
        lastAudible.current = next;
        return next;
      }
      return prev;
    });
  }, []);

  const toggleMuteAll = useCallback(() => {
    if (audible.length) {
      lastAudible.current = audible;
      setAudible([]);
      return;
    }
    const remembered = lastAudible.current.filter(id => slots[id]?.platform);
    const first = slots.find(s => s.platform)?.id;
    const target = remembered.length ? remembered : first !== undefined ? [first] : [];
    if (target.length) {
      lastAudible.current = target;
      setAudible(target);
    }
  }, [audible, slots]);

  const swapSlots = useCallback((fromId: number, toId: number) => {
    setSlots(prev => {
      const next = [...prev];
      next[fromId] = { ...prev[toId], id: fromId };
      next[toId] = { ...prev[fromId], id: toId };
      return next;
    });
    // Audio state and volume follow the stream, not the slot position.
    const remap = (id: number) => (id === fromId ? toId : id === toId ? fromId : id);
    setAudible(prev => prev.map(remap));
    setVolumes(prev => {
      const next = [...prev];
      next[fromId] = prev[toId];
      next[toId] = prev[fromId];
      return next;
    });
    lastAudible.current = lastAudible.current.map(remap);
  }, []);

  const value = useMemo(
    () => ({
      slots,
      filledCount: slots.filter(s => s.platform).length,
      audible,
      audioSlot: audible[0] ?? null,
      volumes,
      layout,
      addVideo,
      addVideos,
      loadSetup,
      clearSlot,
      clearAll,
      toggleSlotAudio,
      toggleSlotMute,
      setSlotVolume,
      toggleMuteAll,
      swapSlots,
      setLayout,
    }),
    [slots, audible, volumes, layout, addVideo, addVideos, loadSetup, clearSlot, clearAll, toggleSlotAudio, toggleSlotMute, setSlotVolume, toggleMuteAll, swapSlots]
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
