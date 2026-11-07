import { useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { updatePrefs, usePrefs } from '../../hooks/usePrefs';
import type { CanvasRect } from '../../hooks/usePrefs';
import { useStreamLabel } from '../../hooks/useStreamLabel';
import { PLATFORM_META } from '../../services/urlParser';
import type { VideoSlot } from '../../types/index.ts';
import { VideoTile } from './VideoTile';
import { CanvasIcon, CheckIcon, CloseIcon, GridIcon, PlusIcon, SpotlightIcon, StageIcon } from '../Icons';
import styles from './NowPlaying.module.css';

/*
 * Custom layout: a freeform canvas. Every stream is a rectangle stored in
 * percent of the canvas, so the arrangement scales with the window. In edit
 * mode a frame covers each tile (iframes would otherwise swallow the
 * pointer); dragging the frame moves the tile, the eight handles resize it.
 * Changes are kept in local state while dragging and written to prefs on
 * release, so localStorage is not hammered on every pointer move.
 *
 * Streams can be taken off the canvas without removing them from their
 * slot; a hidden stream is not rendered, so it stops playing.
 */

const MIN_SIZE = 8;
const SNAP = 2.5;

type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
const RESIZE_HANDLES: Exclude<Handle, 'move'>[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number) => Math.round(v * 100) / 100;

function autoColumns(count: number): number {
  if (count <= 1) return 1;
  if (count <= 4) return 2;
  if (count <= 6) return 3;
  return 4;
}

type Arrangement = 'tile' | 'feature' | 'pip';

function arrange(kind: Arrangement, ids: number[]): Record<number, CanvasRect> {
  const out: Record<number, CanvasRect> = {};
  const n = ids.length;
  if (!n) return out;
  if (kind === 'tile' || n === 1) {
    const cols = autoColumns(n);
    const rows = Math.ceil(n / cols);
    ids.forEach((id, i) => {
      out[id] = { x: round(((i % cols) * 100) / cols), y: round((Math.floor(i / cols) * 100) / rows), w: round(100 / cols), h: round(100 / rows), z: 1 };
    });
  } else if (kind === 'feature') {
    const [first, ...rest] = ids;
    out[first] = { x: 0, y: 0, w: 72, h: 100, z: 1 };
    rest.forEach((id, i) => {
      out[id] = { x: 72, y: round((i * 100) / rest.length), w: 28, h: round(100 / rest.length), z: 1 };
    });
  } else {
    const [first, ...rest] = ids;
    out[first] = { x: 0, y: 0, w: 100, h: 100, z: 1 };
    const size = rest.length > 3 ? 18 : 24;
    rest.forEach((id, i) => {
      out[id] = { x: round(100 - size - 1.5), y: round(100 - (i + 1) * (size + 1.5)), w: size, h: size, z: 2 + i };
    });
  }
  return out;
}

function applyDrag(start: CanvasRect, handle: Handle, dx: number, dy: number, snap: boolean): CanvasRect {
  const s = (v: number) => (snap ? Math.round(v / SNAP) * SNAP : v);
  const { w, h } = start;
  let { x, y } = start;
  if (handle === 'move') {
    x = clamp(s(x + dx), 0, 100 - w);
    y = clamp(s(y + dy), 0, 100 - h);
    return { ...start, x: round(x), y: round(y) };
  }
  const right = x + w;
  const bottom = y + h;
  if (handle.includes('w')) x = clamp(s(x + dx), 0, right - MIN_SIZE);
  if (handle.includes('n')) y = clamp(s(y + dy), 0, bottom - MIN_SIZE);
  const newRight = handle.includes('e') ? clamp(s(right + dx), x + MIN_SIZE, 100) : right;
  const newBottom = handle.includes('s') ? clamp(s(bottom + dy), y + MIN_SIZE, 100) : bottom;
  return { ...start, x: round(x), y: round(y), w: round(newRight - x), h: round(newBottom - y) };
}

interface CanvasLayoutProps {
  slots: VideoSlot[];
  mainId: number;
}

export function CanvasLayout({ slots, mainId }: CanvasLayoutProps) {
  const { canvas, canvasHidden, canvasEdit, canvasSnap, focusMode } = usePrefs();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState<{ id: number; rect: CanvasRect } | null>(null);

  const filled = slots.filter(s => s.platform && s.videoId);
  const visible = filled.filter(s => !canvasHidden.includes(s.id));
  const fallback = arrange('tile', visible.map(s => s.id));
  const rectFor = (id: number): CanvasRect => (draft?.id === id ? draft.rect : (canvas[id] ?? fallback[id]));
  const topZ = Math.max(1, ...visible.map(s => rectFor(s.id).z));

  const commit = (id: number, rect: CanvasRect) => {
    // Pin every visible tile so auto-placed ones don't shift when this one is saved.
    updatePrefs(prev => {
      const next = { ...prev.canvas };
      visible.forEach(s => (next[s.id] = next[s.id] ?? fallback[s.id]));
      next[id] = rect;
      return { canvas: next };
    });
  };

  const bringToFront = (id: number) => {
    const rect = rectFor(id);
    if (rect.z < topZ) commit(id, { ...rect, z: topZ + 1 });
  };

  function startDrag(event: ReactPointerEvent<HTMLElement>, id: number, handle: Handle) {
    if (event.button !== 0) return;
    const root = rootRef.current;
    if (!root) return;
    event.preventDefault();
    event.stopPropagation();
    const box = root.getBoundingClientRect();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const current = rectFor(id);
    const start = { ...current, z: current.z < topZ ? topZ + 1 : current.z };
    const origin = { x: event.clientX, y: event.clientY };
    let latest = start;
    document.documentElement.classList.add('is-dragging');

    const onMove = (e: PointerEvent) => {
      const dx = ((e.clientX - origin.x) / box.width) * 100;
      const dy = ((e.clientY - origin.y) / box.height) * 100;
      latest = applyDrag(start, handle, dx, dy, canvasSnap && !e.altKey);
      setDraft({ id, rect: latest });
    };
    const onUp = () => {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onUp);
      document.documentElement.classList.remove('is-dragging');
      commit(id, latest);
      setDraft(null);
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onUp);
  }

  function onFrameKey(event: ReactKeyboardEvent<HTMLElement>, id: number) {
    const step = event.ctrlKey || event.metaKey ? 0.5 : SNAP;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const d = delta[event.key];
    if (!d) return;
    event.preventDefault();
    event.stopPropagation();
    commit(id, applyDrag(rectFor(id), event.shiftKey ? 'se' : 'move', d[0], d[1], false));
  }

  return (
    <div className={styles.canvasWrap}>
      {canvasEdit ? (
        <CanvasBar filled={filled} />
      ) : (
        !focusMode && (
          <button type="button" className={styles.canvasEditTab} onClick={() => updatePrefs({ canvasEdit: true })} title="Move, resize and choose streams">
            <CanvasIcon size={13} />
            Edit layout
          </button>
        )
      )}
      <div ref={rootRef} className={`${styles.canvas} ${canvasEdit ? styles.canvasEditing : ''}`}>
        {visible.length === 0 && (
          <div className={styles.canvasEmpty}>
            <PlusIcon size={18} />
            <span>{filled.length ? 'Every stream is hidden. Turn one on in Edit layout.' : 'Add streams to arrange them here.'}</span>
          </div>
        )}
        {visible.map(slot => {
          const rect = rectFor(slot.id);
          return (
            <div
              key={slot.id}
              className={styles.canvasItem}
              style={{ left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%`, height: `${rect.h}%`, zIndex: rect.z }}
              onPointerDownCapture={() => !canvasEdit && bringToFront(slot.id)}
            >
              <VideoTile slot={slot} mainId={mainId} compact={rect.w < 22 || rect.h < 22} />
              {canvasEdit && (
                <EditFrame
                  slot={slot}
                  rect={rect}
                  onStart={(e, handle) => startDrag(e, slot.id, handle)}
                  onKey={e => onFrameKey(e, slot.id)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface EditFrameProps {
  slot: VideoSlot;
  rect: CanvasRect;
  onStart: (event: ReactPointerEvent<HTMLElement>, handle: Handle) => void;
  onKey: (event: ReactKeyboardEvent<HTMLElement>) => void;
}

function EditFrame({ slot, rect, onStart, onKey }: EditFrameProps) {
  const { label } = useStreamLabel(slot.platform!, slot.videoId!);
  const hide = () => updatePrefs(prev => ({ canvasHidden: [...prev.canvasHidden, slot.id] }));
  return (
    <div
      className={styles.editFrame}
      style={{ ['--platform' as string]: PLATFORM_META[slot.platform!].color }}
      onPointerDown={e => onStart(e, 'move')}
      onKeyDown={onKey}
      tabIndex={0}
      role="group"
      aria-label={`${label}: drag to move, arrow keys to nudge, Shift+arrows to resize`}
    >
      <div className={styles.editHead}>
        <span className={styles.badgeDot} />
        <span className={styles.editName}>
          {slot.id + 1} · {label}
        </span>
        <button
          type="button"
          className={styles.editHide}
          onPointerDown={e => e.stopPropagation()}
          onClick={hide}
          aria-label={`Hide ${label}`}
          title="Take off the canvas (stops playing)"
        >
          <CloseIcon size={12} />
        </button>
      </div>
      <span className={styles.editSize}>
        {Math.round(rect.w)} × {Math.round(rect.h)}
      </span>
      {RESIZE_HANDLES.map(h => (
        <span key={h} className={`${styles.handle} ${styles[`handle_${h}`]}`} onPointerDown={e => onStart(e, h)} aria-hidden="true" />
      ))}
    </div>
  );
}

function StreamToggle({ slot }: { slot: VideoSlot }) {
  const { canvasHidden } = usePrefs();
  const { label } = useStreamLabel(slot.platform!, slot.videoId!);
  const shown = !canvasHidden.includes(slot.id);
  const toggle = () =>
    updatePrefs(prev => ({
      canvasHidden: shown ? [...prev.canvasHidden, slot.id] : prev.canvasHidden.filter(id => id !== slot.id),
    }));
  return (
    <button
      type="button"
      className={`${styles.hudChip} ${shown ? styles.hudChipActive : ''}`}
      style={{ ['--platform' as string]: PLATFORM_META[slot.platform!].color }}
      onClick={toggle}
      aria-pressed={shown}
      title={shown ? `Hide ${label}` : `Show ${label}`}
    >
      <span className={styles.badgeDot} />
      <span className={styles.canvasChipName}>
        {slot.id + 1} · {label}
      </span>
    </button>
  );
}

function CanvasBar({ filled }: { filled: VideoSlot[] }) {
  const { canvasHidden, canvasSnap } = usePrefs();
  const visibleIds = filled.filter(s => !canvasHidden.includes(s.id)).map(s => s.id);
  const preset = (kind: Arrangement) => updatePrefs({ canvas: arrange(kind, visibleIds) });

  return (
    <div className={styles.canvasBar} role="toolbar" aria-label="Custom layout editor">
      <span className="tag">Edit layout</span>
      <div className={styles.canvasBarGroup}>
        <span className={styles.canvasBarLabel}>Streams</span>
        {filled.length ? filled.map(s => <StreamToggle key={s.id} slot={s} />) : <span className={styles.hint}>none yet</span>}
      </div>
      <div className={styles.canvasBarGroup}>
        <span className={styles.canvasBarLabel}>Arrange</span>
        <button type="button" className={styles.hudButton} onClick={() => preset('tile')} title="Equal tiles">
          <GridIcon size={14} />
          <span>Tile</span>
        </button>
        <button type="button" className={styles.hudButton} onClick={() => preset('feature')} title="One large, the rest in a column">
          <SpotlightIcon size={14} />
          <span>Feature</span>
        </button>
        <button type="button" className={styles.hudButton} onClick={() => preset('pip')} title="One full screen, the rest picture-in-picture">
          <StageIcon size={14} />
          <span>PiP</span>
        </button>
      </div>
      <label className={styles.canvasSnap} title="Hold Alt while dragging to place freely">
        <input type="checkbox" checked={canvasSnap} onChange={e => updatePrefs({ canvasSnap: e.target.checked })} />
        Snap
      </label>
      <button type="button" className={`${styles.hudButton} ${styles.canvasDone}`} onClick={() => updatePrefs({ canvasEdit: false })}>
        <CheckIcon size={14} />
        <span>Done</span>
      </button>
    </div>
  );
}
