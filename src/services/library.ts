import { useSyncExternalStore } from 'react';
import type { LayoutMode, Platform, VideoSlot } from '../types/index.ts';
import { getPrefs, updatePrefs } from '../hooks/usePrefs';
import type { CanvasRect } from '../hooks/usePrefs';

/*
 * Viewer "library": recently added streams, named saved setups, and
 * shareable links. Everything lives in this browser (localStorage); share
 * links carry the setup in the URL fragment, which never reaches the server.
 */

export interface StreamRef {
  platform: Platform;
  videoId: string;
}

export interface SavedSetup {
  id: string;
  name: string;
  layout: LayoutMode;
  streams: StreamRef[];
  /** Custom-layout placement per stream, aligned with `streams`. */
  canvas?: CanvasPlacement[];
  savedAt: string;
}

/*
 * Compact per-stream canvas placement used by saved setups and share
 * links: [x, y, w, h, z] in percent, 0 = auto-placed, -1 = hidden.
 */
export type CanvasPlacement = [number, number, number, number, number] | 0 | -1;

function validPlacement(value: unknown): value is CanvasPlacement {
  if (value === 0 || value === -1) return true;
  return (
    Array.isArray(value) &&
    value.length === 5 &&
    value.every(v => typeof v === 'number' && Number.isFinite(v)) &&
    value[2] > 0 &&
    value[3] > 0 &&
    value[0] >= 0 &&
    value[1] >= 0 &&
    value[0] + value[2] <= 100.5 &&
    value[1] + value[3] <= 100.5
  );
}

function validCanvas(value: unknown, length: number): value is CanvasPlacement[] {
  return Array.isArray(value) && value.length === length && value.every(validPlacement);
}

function filledSlots(slots: VideoSlot[]) {
  return slots.filter(s => s.platform && s.videoId);
}

/** Captures the current custom-layout placement of the given (filled) slots. */
function captureCanvas(slots: VideoSlot[]): CanvasPlacement[] {
  const { canvas, canvasHidden } = getPrefs();
  return slots.map(slot => {
    if (canvasHidden.includes(slot.id)) return -1;
    const r = canvas[slot.id];
    return r ? [r.x, r.y, r.w, r.h, r.z] : 0;
  });
}

/*
 * Restores a captured placement. loadSetup puts stream i into slot i, so
 * placement i becomes slot i's rect. Without one, the canvas is reset to
 * automatic tiling so stale rects from other streams don't apply.
 */
export function applyCanvas(placements: CanvasPlacement[] | undefined) {
  const canvas: Record<number, CanvasRect> = {};
  const canvasHidden: number[] = [];
  placements?.forEach((p, i) => {
    if (p === -1) canvasHidden.push(i);
    else if (p !== 0) canvas[i] = { x: p[0], y: p[1], w: p[2], h: p[3], z: p[4] };
  });
  updatePrefs({ canvas, canvasHidden });
}

interface LibraryState {
  recent: (StreamRef & { addedAt: string })[];
  setups: SavedSetup[];
}

const KEY = 'twill:library:v1';
const MAX_RECENT = 12;
const PLATFORMS: Platform[] = ['youtube', 'twitch', 'kick', 'custom'];
const LAYOUTS: LayoutMode[] = ['stage', 'spotlight', 'theater', 'grid', 'custom'];

function validStream(value: unknown): value is StreamRef {
  const v = value as StreamRef;
  if (!v || !PLATFORMS.includes(v.platform) || typeof v.videoId !== 'string' || !v.videoId || v.videoId.length > 2000) return false;
  if (v.platform !== 'custom') return /^[\w@./-]+$/.test(v.videoId);
  try {
    return /^https?:$/.test(new URL(v.videoId).protocol);
  } catch {
    return false;
  }
}

/** Private archive media needs the Archives login and must never be shared. */
export function isPrivateStream(stream: StreamRef): boolean {
  if (stream.platform !== 'custom') return false;
  try {
    return new URL(stream.videoId).pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

function load(): LibraryState {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return {
      recent: Array.isArray(data?.recent) ? data.recent.filter(validStream).slice(0, MAX_RECENT) : [],
      setups: Array.isArray(data?.setups)
        ? data.setups.filter(
            (s: SavedSetup) => s && typeof s.name === 'string' && LAYOUTS.includes(s.layout) && Array.isArray(s.streams) && s.streams.every(validStream) && (s.canvas === undefined || validCanvas(s.canvas, s.streams.length))
          )
        : [],
    };
  } catch {
    return { recent: [], setups: [] };
  }
}

let state = load();
const listeners = new Set<() => void>();

function commit(next: LibraryState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Not persisted; still works for this tab.
  }
  listeners.forEach(l => l());
}

export function useLibrary(): LibraryState {
  return useSyncExternalStore(
    l => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state
  );
}

const same = (a: StreamRef, b: StreamRef) => a.platform === b.platform && a.videoId === b.videoId;

export function rememberStreams(streams: StreamRef[]) {
  if (!streams.length) return;
  const stamped = streams.map(s => ({ platform: s.platform, videoId: s.videoId, addedAt: new Date().toISOString() }));
  const rest = state.recent.filter(r => !stamped.some(s => same(r, s)));
  commit({ ...state, recent: [...stamped.reverse(), ...rest].slice(0, MAX_RECENT) });
}

export function forgetRecent(stream: StreamRef) {
  commit({ ...state, recent: state.recent.filter(r => !same(r, stream)) });
}

export function clearRecent() {
  commit({ ...state, recent: [] });
}

export function saveSetup(name: string, layout: LayoutMode, slots: VideoSlot[]): SavedSetup {
  const setup: SavedSetup = {
    id: crypto.randomUUID(),
    name: name.trim().slice(0, 60) || 'Untitled setup',
    layout,
    streams: filledSlots(slots).map(s => ({ platform: s.platform!, videoId: s.videoId! })),
    canvas: layout === 'custom' ? captureCanvas(filledSlots(slots)) : undefined,
    savedAt: new Date().toISOString(),
  };
  commit({ ...state, setups: [setup, ...state.setups.filter(s => s.name !== setup.name)].slice(0, 30) });
  return setup;
}

export function deleteSetup(id: string) {
  commit({ ...state, setups: state.setups.filter(s => s.id !== id) });
}

/* ------------------------------------------------------------ sharing */

const SHARE_PARAM = 'watch';

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach(b => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): string {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0)));
}

export function buildShareUrl(layout: LayoutMode, slots: VideoSlot[]): string {
  const shared = filledSlots(slots).filter(s => !isPrivateStream({ platform: s.platform!, videoId: s.videoId! }));
  const payload = {
    v: 1,
    l: layout,
    s: shared.map(s => [s.platform, s.videoId]),
    ...(layout === 'custom' ? { c: captureCanvas(shared) } : {}),
  };
  const url = new URL('/', window.location.origin);
  url.hash = new URLSearchParams({ [SHARE_PARAM]: toBase64Url(JSON.stringify(payload)) }).toString();
  return url.toString();
}

/** Reads a shared setup from the current URL fragment, if any. */
export function readSharedSetup(): { layout: LayoutMode; streams: StreamRef[]; canvas?: CanvasPlacement[] } | null {
  try {
    const encoded = new URLSearchParams(window.location.hash.slice(1)).get(SHARE_PARAM);
    if (!encoded) return null;
    const data = JSON.parse(fromBase64Url(encoded));
    const raw: unknown[] = Array.isArray(data?.s) ? data.s : [];
    const placements: unknown[] | null = Array.isArray(data?.c) && data.c.length === raw.length ? data.c : null;
    const kept: { stream: StreamRef; placement: unknown }[] = [];
    raw.forEach((entry, i) => {
      if (!Array.isArray(entry)) return;
      const stream = { platform: entry[0] as Platform, videoId: entry[1] as string };
      if (validStream(stream) && !isPrivateStream(stream)) kept.push({ stream, placement: placements?.[i] });
    });
    const trimmed = kept.slice(0, 8);
    if (!trimmed.length) return null;
    const streams = trimmed.map(k => k.stream);
    const canvas = trimmed.map(k => k.placement);
    return {
      layout: LAYOUTS.includes(data.l) ? data.l : 'stage',
      streams,
      canvas: placements && validCanvas(canvas, streams.length) ? canvas : undefined,
    };
  } catch {
    return null;
  }
}

export function clearShareFromUrl() {
  if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
}
