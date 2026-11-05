import { useSyncExternalStore } from 'react';
import type { LayoutMode, Platform, VideoSlot } from '../types/index.ts';

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
  savedAt: string;
}

interface LibraryState {
  recent: (StreamRef & { addedAt: string })[];
  setups: SavedSetup[];
}

const KEY = 'twill:library:v1';
const MAX_RECENT = 12;
const PLATFORMS: Platform[] = ['youtube', 'twitch', 'kick', 'custom'];
const LAYOUTS: LayoutMode[] = ['stage', 'spotlight', 'theater', 'grid'];

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
            (s: SavedSetup) => s && typeof s.name === 'string' && LAYOUTS.includes(s.layout) && Array.isArray(s.streams) && s.streams.every(validStream)
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
    streams: slots.filter(s => s.platform && s.videoId).map(s => ({ platform: s.platform!, videoId: s.videoId! })),
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
  const payload = {
    v: 1,
    l: layout,
    s: slots
      .filter(s => s.platform && s.videoId && !isPrivateStream({ platform: s.platform, videoId: s.videoId }))
      .map(s => [s.platform, s.videoId]),
  };
  const url = new URL('/', window.location.origin);
  url.hash = new URLSearchParams({ [SHARE_PARAM]: toBase64Url(JSON.stringify(payload)) }).toString();
  return url.toString();
}

/** Reads a shared setup from the current URL fragment, if any. */
export function readSharedSetup(): { layout: LayoutMode; streams: StreamRef[] } | null {
  try {
    const encoded = new URLSearchParams(window.location.hash.slice(1)).get(SHARE_PARAM);
    if (!encoded) return null;
    const data = JSON.parse(fromBase64Url(encoded));
    const streams = (Array.isArray(data?.s) ? data.s : [])
      .map(([platform, videoId]: [Platform, string]) => ({ platform, videoId }))
      .filter((s: StreamRef) => validStream(s) && !isPrivateStream(s))
      .slice(0, 8);
    if (!streams.length) return null;
    return { layout: LAYOUTS.includes(data.l) ? data.l : 'stage', streams };
  } catch {
    return null;
  }
}

export function clearShareFromUrl() {
  if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
}
