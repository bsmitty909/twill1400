import { useSyncExternalStore } from 'react';

/*
 * Viewer preferences shared by the toolbar, layouts, tiles and chat panel.
 * A tiny external store (not React state) so any component can read or
 * update a single field without prop drilling; persisted to localStorage.
 */

export type GridColumns = 'auto' | 1 | 2 | 3 | 4;

export interface Prefs {
  gridColumns: GridColumns;
  /** Space between tiles in px. */
  gap: number;
  showLabels: boolean;
  chatOpen: boolean;
  /** Slot whose chat is shown; null follows the main stream. */
  chatSlot: number | null;
  chatWidth: number;
  focusMode: boolean;
  /** Slot shown alone (fills the viewport); null shows the whole layout. */
  soloSlot: number | null;
  sizes: {
    stageColumns: number[];
    stageMain: number[];
    spotlight: number[];
    theater: number[];
  };
}

const KEY = 'twill:prefs:v1';

/*
 * YouTube's live_chat page will not lay out narrower than ~298px (its
 * content overflows and gets clipped), so the chat panel stops at 320px.
 */
export const CHAT_MIN_WIDTH = 320;
export const CHAT_MAX_WIDTH = 640;

export const DEFAULT_SIZES: Prefs['sizes'] = {
  stageColumns: [16, 68, 16],
  stageMain: [50, 50],
  spotlight: [74, 26],
  theater: [76, 24],
};

const DEFAULTS: Prefs = {
  gridColumns: 'auto',
  gap: 10,
  showLabels: true,
  chatOpen: false,
  chatSlot: null,
  chatWidth: 340,
  focusMode: false,
  soloSlot: null,
  sizes: DEFAULT_SIZES,
};

function validSizes(value: unknown, length: number): value is number[] {
  return Array.isArray(value) && value.length === length && value.every(v => typeof v === 'number' && v > 0 && v < 100);
}

function load(): Prefs {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!saved || typeof saved !== 'object') return DEFAULTS;
    const sizes = { ...DEFAULT_SIZES };
    for (const [name, length] of [['stageColumns', 3], ['stageMain', 2], ['spotlight', 2], ['theater', 2]] as const) {
      if (validSizes(saved.sizes?.[name], length)) sizes[name] = saved.sizes[name];
    }
    return {
      gridColumns: ['auto', 1, 2, 3, 4].includes(saved.gridColumns) ? saved.gridColumns : DEFAULTS.gridColumns,
      gap: Number.isFinite(saved.gap) ? Math.min(24, Math.max(0, saved.gap)) : DEFAULTS.gap,
      showLabels: typeof saved.showLabels === 'boolean' ? saved.showLabels : DEFAULTS.showLabels,
      chatOpen: typeof saved.chatOpen === 'boolean' ? saved.chatOpen : DEFAULTS.chatOpen,
      chatSlot: Number.isInteger(saved.chatSlot) ? saved.chatSlot : null,
      chatWidth: Number.isFinite(saved.chatWidth) ? Math.min(CHAT_MAX_WIDTH, Math.max(CHAT_MIN_WIDTH, saved.chatWidth)) : DEFAULTS.chatWidth,
      focusMode: false,
      soloSlot: null,
      sizes,
    };
  } catch {
    return DEFAULTS;
  }
}

let state: Prefs = load();
const listeners = new Set<() => void>();

export function updatePrefs(patch: Partial<Prefs> | ((prev: Prefs) => Partial<Prefs>)) {
  const delta = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...delta };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable: preferences last for this tab only.
  }
  listeners.forEach(listener => listener());
}

export function updateSizes(name: keyof Prefs['sizes'], sizes: number[]) {
  updatePrefs(prev => ({ sizes: { ...prev.sizes, [name]: sizes } }));
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => DEFAULTS
  );
}
