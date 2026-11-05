import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useVideo, SLOT_COUNT } from '../../contexts/VideoContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { CHAT_MAX_WIDTH, CHAT_MIN_WIDTH, DEFAULT_SIZES, updatePrefs, usePrefs } from '../../hooks/usePrefs';
import type { GridColumns } from '../../hooks/usePrefs';
import { PLATFORM_META } from '../../services/urlParser';
import { useStreamLabel } from '../../hooks/useStreamLabel';
import type { LayoutMode, VideoSlot } from '../../types/index.ts';
import { VideoGrid } from './VideoGrid';
import { Welcome } from './Welcome';
import { FocusHud } from './FocusHud';
import { Mixer } from './VolumeControl';
import { SetupsPanel, ShareButton, SharedSetupBanner } from './Library';
import type { Notify } from './Library';
import {
  BookmarkIcon,
  ChatIcon,
  CloseIcon,
  FocusIcon,
  GridIcon,
  KeyboardIcon,
  SlidersIcon,
  SpotlightIcon,
  StageIcon,
  TheaterIcon,
  TrashIcon,
  VolumeOffIcon,
  VolumeOnIcon,
} from '../Icons';
import styles from './NowPlaying.module.css';

const LAYOUTS: { id: LayoutMode; label: string; Icon: typeof StageIcon }[] = [
  { id: 'stage', label: 'Stage', Icon: StageIcon },
  { id: 'spotlight', label: 'Spotlight', Icon: SpotlightIcon },
  { id: 'theater', label: 'Theater', Icon: TheaterIcon },
  { id: 'grid', label: 'Grid', Icon: GridIcon },
];

const SHORTCUTS: [string, string][] = [
  ['F', 'Focus mode (streams only)'],
  ['S', 'Solo the stream you hear'],
  ['1-8', 'Listen to that slot'],
  ['M', 'Mute / unmute'],
  ['L', 'Next layout'],
  ['C', 'Toggle chat'],
  ['/', 'Paste a new link'],
  ['Esc', 'Leave solo, then focus'],
];

/* ------------------------------------------------------------ chat */

/** Chat embed URL for a slot, or null when that platform/stream has none. */
function chatUrl(slot: VideoSlot): string | null {
  const host = window.location.hostname;
  if (!slot.platform || !slot.videoId) return null;
  switch (slot.platform) {
    case 'youtube': {
      const url = new URL('https://www.youtube.com/live_chat');
      url.searchParams.set('v', slot.videoId);
      url.searchParams.set('embed_domain', host);
      url.searchParams.set('dark_theme', '1');
      return url.toString();
    }
    case 'twitch': {
      if (slot.videoId.startsWith('videos/')) return null;
      const url = new URL(`https://www.twitch.tv/embed/${encodeURIComponent(slot.videoId)}/chat`);
      url.searchParams.set('parent', host);
      url.searchParams.set('darkpopout', '');
      return url.toString();
    }
    case 'kick':
      return `https://kick.com/popout/${encodeURIComponent(slot.videoId)}/chat`;
    default:
      return null;
  }
}

/** <option> children must be plain text, so the label is resolved here. */
function ChatOption({ slot }: { slot: VideoSlot }) {
  const { label } = useStreamLabel(slot.platform!, slot.videoId!);
  return (
    <option value={slot.id}>
      {`${slot.id + 1}. ${PLATFORM_META[slot.platform!].name} - ${label}`}
    </option>
  );
}

function ChatPanel({ isNarrow }: { isNarrow: boolean }) {
  const { slots } = useVideo();
  const { chatSlot, chatWidth } = usePrefs();
  const chattable = slots.filter(s => chatUrl(s));
  const selected = chattable.find(s => s.id === chatSlot) ?? chattable[0];
  const src = selected ? chatUrl(selected) : null;

  /*
   * Pointer capture keeps the drag alive while the cursor crosses the chat
   * or video iframes (which would otherwise swallow the events), and every
   * end path - release, cancel, lost capture - clears the drag state so the
   * embeds never stay unclickable.
   */
  const startResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const handle = e.currentTarget;
    const startX = e.clientX;
    const startWidth = chatWidth;
    let frame = 0;
    handle.setPointerCapture(e.pointerId);
    document.documentElement.classList.add('is-dragging');

    const onMove = (ev: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        updatePrefs({ chatWidth: Math.min(CHAT_MAX_WIDTH, Math.max(CHAT_MIN_WIDTH, startWidth + (startX - ev.clientX))) })
      );
    };
    const onEnd = () => {
      document.documentElement.classList.remove('is-dragging');
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onEnd);
      handle.removeEventListener('pointercancel', onEnd);
      handle.removeEventListener('lostpointercapture', onEnd);
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onEnd);
    handle.addEventListener('pointercancel', onEnd);
    handle.addEventListener('lostpointercapture', onEnd);
  };

  return (
    <>
      {!isNarrow && (
        <div
          className={styles.chatResizer}
          onPointerDown={startResize}
          onDoubleClick={() => updatePrefs({ chatWidth: 340 })}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize chat"
          aria-valuemin={CHAT_MIN_WIDTH}
          aria-valuemax={CHAT_MAX_WIDTH}
          aria-valuenow={chatWidth}
          title="Drag to resize chat (double-click to reset)"
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'ArrowLeft') updatePrefs({ chatWidth: Math.min(CHAT_MAX_WIDTH, chatWidth + 20) });
            if (e.key === 'ArrowRight') updatePrefs({ chatWidth: Math.max(CHAT_MIN_WIDTH, chatWidth - 20) });
          }}
        />
      )}
    <aside className={styles.chat} style={isNarrow ? undefined : { width: chatWidth }} aria-label="Live chat">
      <div className={styles.chatHeader}>
        <ChatIcon size={15} />
        {chattable.length > 0 ? (
          <select
            className={styles.chatSelect}
            value={selected?.id}
            onChange={e => updatePrefs({ chatSlot: Number(e.target.value) })}
            aria-label="Chat for stream"
          >
            {chattable.map(s => (
              <ChatOption key={s.id} slot={s} />
            ))}
          </select>
        ) : (
          <span className={styles.chatTitle}>Live chat</span>
        )}
        <button type="button" className={styles.chatClose} onClick={() => updatePrefs({ chatOpen: false })} aria-label="Close chat">
          <CloseIcon size={15} />
        </button>
      </div>
      {src ? (
        <iframe key={src} className={styles.chatFrame} src={src} title="Live chat" />
      ) : (
        <p className={styles.chatEmpty}>Chat is available for live YouTube, Twitch, and Kick streams. Add one to see its chat here.</p>
      )}
    </aside>
    </>
  );
}

/* --------------------------------------------------------- popovers */

function Popover({ label, icon, active, children }: { label: string; icon: ReactNode; active?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={styles.popoverWrap} ref={ref}>
      <button
        type="button"
        className={`${styles.toolButton} ${open || active ? styles.toolButtonActive : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={label}
        aria-label={label}
      >
        {icon}
        <span className={styles.toolLabel}>{label}</span>
      </button>
      {open && (
        <div className={styles.popover} role="dialog" aria-label={label}>
          {children}
        </div>
      )}
    </div>
  );
}

function CustomizePanel() {
  const { gridColumns, gap, showLabels } = usePrefs();
  const { layout } = useVideo();
  const columnOptions: GridColumns[] = ['auto', 1, 2, 3, 4];

  return (
    <div className={styles.customize}>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>Grid columns{layout !== 'grid' && <em> (Grid layout)</em>}</span>
        <div className={styles.segmented} role="radiogroup" aria-label="Grid columns">
          {columnOptions.map(c => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={gridColumns === c}
              className={`${styles.segment} ${gridColumns === c ? styles.segmentActive : ''}`}
              onClick={() => updatePrefs({ gridColumns: c })}
            >
              {c === 'auto' ? 'Auto' : c}
            </button>
          ))}
        </div>
      </div>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>
          Tile spacing <strong>{gap}px</strong>
        </span>
        <input type="range" min={0} max={24} step={2} value={gap} onChange={e => updatePrefs({ gap: Number(e.target.value) })} />
      </label>

      <label className={styles.toggleRow}>
        <span>Show stream names</span>
        <input type="checkbox" checked={showLabels} onChange={e => updatePrefs({ showLabels: e.target.checked })} />
      </label>

      <button type="button" className={styles.resetButton} onClick={() => updatePrefs({ sizes: DEFAULT_SIZES })}>
        Reset pane sizes
      </button>
      <p className={styles.hint}>Drag the dividers between streams to resize in real time. Sizes are saved per layout.</p>
    </div>
  );
}

/* ---------------------------------------------------------- toolbar */

function Toolbar({ notify }: { notify: Notify }) {
  const { slots, filledCount, audible, layout, setLayout, toggleMuteAll, toggleSlotAudio, clearAll } = useVideo();
  const audioSlot = audible.length ? audible[0] : null;
  const { chatOpen } = usePrefs();
  const isNarrow = useMediaQuery('(max-width: 900px)');
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!confirmClear) return;
    const timer = window.setTimeout(() => setConfirmClear(false), 3000);
    return () => window.clearTimeout(timer);
  }, [confirmClear]);

  const handleClear = () => {
    if (confirmClear) {
      clearAll();
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
    }
  };

  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarGroup}>
        <h1 className={styles.title}>Now Playing</h1>
        <span className={styles.count}>
          {filledCount}/{SLOT_COUNT}
        </span>
      </div>

      <div className={styles.toolbarGroup} role="group" aria-label="Audio source">
        <button
          type="button"
          className={`${styles.toolButton} ${audioSlot === null ? '' : styles.toolButtonActive}`}
          onClick={toggleMuteAll}
          disabled={filledCount === 0}
          title="Mute / unmute (M)"
          aria-label={audioSlot === null ? 'Unmute' : 'Mute all'}
        >
          {audioSlot === null ? <VolumeOffIcon size={16} /> : <VolumeOnIcon size={16} />}
          <span className={styles.toolLabel}>{audioSlot === null ? 'Unmute' : 'Mute all'}</span>
        </button>
        <div className={styles.audioChips}>
          {slots.map(slot => {
            const color = slot.platform ? PLATFORM_META[slot.platform].color : undefined;
            return (
              <button
                key={slot.id}
                type="button"
                className={`${styles.audioChip} ${audible.includes(slot.id) ? styles.audioChipActive : ''}`}
                style={color ? { ['--platform' as string]: color } : undefined}
                onClick={() => toggleSlotAudio(slot.id)}
                disabled={!slot.platform}
                aria-pressed={audible.includes(slot.id)}
                aria-label={`Audio from slot ${slot.id + 1}`}
                title={slot.platform ? `Slot ${slot.id + 1} - ${PLATFORM_META[slot.platform].name} (${slot.id + 1})` : `Slot ${slot.id + 1} - empty`}
              >
                {slot.id + 1}
              </button>
            );
          })}
        </div>
        <Popover label="Mixer" icon={<SlidersIcon size={16} />}>
          <Mixer />
        </Popover>
      </div>

      <div className={`${styles.toolbarGroup} ${styles.toolbarEnd}`}>
        <button
          type="button"
          className={styles.focusCta}
          onClick={() => updatePrefs({ focusMode: true })}
          title="Hide everything but the streams (F)"
          aria-label="Focus mode"
        >
          <FocusIcon size={16} />
          <span>Focus</span>
          <kbd>F</kbd>
        </button>
        {!isNarrow && (
          <div className={styles.segmented} role="radiogroup" aria-label="Layout">
            {LAYOUTS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={layout === id}
                className={`${styles.segment} ${layout === id ? styles.segmentActive : ''}`}
                onClick={() => setLayout(id)}
                title={`${label} layout (L cycles)`}
                aria-label={label}
              >
                <Icon size={15} />
                <span className={styles.segmentLabel}>{label}</span>
              </button>
            ))}
          </div>
        )}
        <ShareButton notify={notify} />
        <Popover label="Setups" icon={<BookmarkIcon size={16} />}>
          <SetupsPanel notify={notify} />
        </Popover>
        <button
          type="button"
          className={`${styles.toolButton} ${chatOpen ? styles.toolButtonActive : ''}`}
          onClick={() => updatePrefs({ chatOpen: !chatOpen })}
          aria-pressed={chatOpen}
          title="Live chat (C)"
          aria-label="Chat"
        >
          <ChatIcon size={16} />
          <span className={styles.toolLabel}>Chat</span>
        </button>
        {!isNarrow && (
          <Popover label="Customize" icon={<SlidersIcon size={16} />}>
            <CustomizePanel />
          </Popover>
        )}
        {!isNarrow && (
          <Popover label="Shortcuts" icon={<KeyboardIcon size={16} />}>
            <ul className={styles.shortcuts}>
              {SHORTCUTS.map(([key, text]) => (
                <li key={key}>
                  <kbd>{key}</kbd>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </Popover>
        )}
        <button
          type="button"
          className={`${styles.toolButton} ${confirmClear ? styles.toolButtonDanger : ''}`}
          onClick={handleClear}
          disabled={filledCount === 0}
          title={confirmClear ? 'Click again to remove all streams' : 'Clear all'}
          aria-label={confirmClear ? 'Click to confirm' : 'Clear all'}
        >
          <TrashIcon size={16} />
          <span className={styles.toolLabel}>{confirmClear ? 'Click to confirm' : 'Clear all'}</span>
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- shortcuts */

function useKeyboardShortcuts() {
  const { slots, layout, setLayout, toggleMuteAll, toggleSlotAudio } = useVideo();
  const { chatOpen, focusMode, soloSlot } = usePrefs();
  const { audioSlot } = useVideo();

  const handler = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      if (window.location.pathname.startsWith('/archives')) return;

      const key = e.key.toLowerCase();
      if (/^[1-8]$/.test(key)) {
        const id = Number(key) - 1;
        if (slots[id]?.platform) toggleSlotAudio(id);
      } else if (key === 'm') toggleMuteAll();
      else if (key === 'c') updatePrefs({ chatOpen: !chatOpen });
      else if (key === 'f') {
        if (focusMode && document.fullscreenElement) void document.exitFullscreen();
        updatePrefs(focusMode ? { focusMode: false, soloSlot: null } : { focusMode: true });
      } else if (key === 's') {
        const target = audioSlot ?? slots.find(sl => sl.platform)?.id;
        if (soloSlot !== null) updatePrefs({ soloSlot: null });
        else if (target !== undefined) updatePrefs({ soloSlot: target, focusMode: true });
      } else if (key === 'escape' && soloSlot !== null) updatePrefs({ soloSlot: null });
      else if (key === 'escape' && focusMode) updatePrefs({ focusMode: false });
      else if (key === 'l') {
        const index = LAYOUTS.findIndex(l => l.id === layout);
        setLayout(LAYOUTS[(index + 1) % LAYOUTS.length].id);
      } else return;
      e.preventDefault();
    },
    [slots, layout, setLayout, toggleMuteAll, toggleSlotAudio, chatOpen, focusMode, soloSlot, audioSlot]
  );

  useEffect(() => {
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handler]);
}

/* ------------------------------------------------------------ page */

export function NowPlaying() {
  const { filledCount } = useVideo();
  const { chatOpen, focusMode } = usePrefs();
  const isNarrow = useMediaQuery('(max-width: 900px)');
  useKeyboardShortcuts();

  const focusActive = focusMode && filledCount > 0;

  useEffect(() => {
    document.documentElement.classList.toggle('focus-mode', focusActive);
    return () => document.documentElement.classList.remove('focus-mode');
  }, [focusActive]);

  // Leaving focus (any way) also leaves solo and browser fullscreen.
  useEffect(() => {
    if (focusActive) return;
    updatePrefs(prev => (prev.soloSlot !== null ? { soloSlot: null } : {}));
    if (document.fullscreenElement) void document.exitFullscreen();
  }, [focusActive]);

  const showChat = chatOpen && filledCount > 0;
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; text: string; id: number } | null>(null);
  const notify: Notify = useCallback((tone, text) => setToast({ tone, text, id: Date.now() }), []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  return (
    <main className={`${styles.container} ${focusActive ? styles.focus : ''}`}>
      {!focusActive && <SharedSetupBanner notify={notify} />}
      {!focusActive && filledCount > 0 && <Toolbar notify={notify} />}
      {focusActive && <FocusHud />}
      {filledCount === 0 ? (
        <Welcome notify={notify} />
      ) : (
        <div className={`${styles.workspace} ${isNarrow ? styles.workspaceStacked : ''}`}>
          <div className={styles.viewport}>
            <VideoGrid />
          </div>
          {showChat && <ChatPanel isNarrow={isNarrow} />}
        </div>
      )}
      {toast && (
        <div key={toast.id} className={`${styles.toast} ${toast.tone === 'error' ? styles.toastError : styles.toastSuccess}`} role="status">
          {toast.text}
        </div>
      )}
    </main>
  );
}
