import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useVideo, SLOT_COUNT } from '../../contexts/VideoContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { DEFAULT_SIZES, updatePrefs, usePrefs } from '../../hooks/usePrefs';
import type { GridColumns } from '../../hooks/usePrefs';
import { getSlotLabel, PLATFORM_META } from '../../services/urlParser';
import type { LayoutMode, VideoSlot } from '../../types/index.ts';
import { VideoGrid } from './VideoGrid';
import {
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
  ['1-8', 'Listen to that slot'],
  ['M', 'Mute / unmute'],
  ['L', 'Next layout'],
  ['C', 'Toggle chat'],
  ['F', 'Focus mode'],
  ['/', 'Paste a new link'],
  ['Esc', 'Exit focus mode'],
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

function ChatPanel({ isNarrow }: { isNarrow: boolean }) {
  const { slots } = useVideo();
  const { chatSlot, chatWidth } = usePrefs();
  const chattable = slots.filter(s => chatUrl(s));
  const selected = chattable.find(s => s.id === chatSlot) ?? chattable[0];
  const src = selected ? chatUrl(selected) : null;

  const startResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = chatWidth;
    document.documentElement.classList.add('is-dragging');
    const onMove = (ev: PointerEvent) => {
      updatePrefs({ chatWidth: Math.min(640, Math.max(260, startWidth + (startX - ev.clientX))) });
    };
    const onUp = () => {
      document.documentElement.classList.remove('is-dragging');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <aside className={styles.chat} style={isNarrow ? undefined : { width: chatWidth }} aria-label="Live chat">
      {!isNarrow && (
        <div
          className={styles.chatHandle}
          onPointerDown={startResize}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize chat"
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'ArrowLeft') updatePrefs({ chatWidth: Math.min(640, chatWidth + 20) });
            if (e.key === 'ArrowRight') updatePrefs({ chatWidth: Math.max(260, chatWidth - 20) });
          }}
        />
      )}
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
              <option key={s.id} value={s.id}>
                {s.id + 1}. {PLATFORM_META[s.platform!].name} - {getSlotLabel(s.platform!, s.videoId!)}
              </option>
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

function Toolbar() {
  const { slots, filledCount, audioSlot, layout, setLayout, toggleMuteAll, toggleSlotAudio, clearAll } = useVideo();
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
                className={`${styles.audioChip} ${audioSlot === slot.id ? styles.audioChipActive : ''}`}
                style={color ? { ['--platform' as string]: color } : undefined}
                onClick={() => toggleSlotAudio(slot.id)}
                disabled={!slot.platform}
                aria-pressed={audioSlot === slot.id}
                aria-label={`Audio from slot ${slot.id + 1}`}
                title={slot.platform ? `Slot ${slot.id + 1} - ${PLATFORM_META[slot.platform].name} (${slot.id + 1})` : `Slot ${slot.id + 1} - empty`}
              >
                {slot.id + 1}
              </button>
            );
          })}
        </div>
      </div>

      <div className={`${styles.toolbarGroup} ${styles.toolbarEnd}`}>
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
              >
                <Icon size={15} />
                <span className={styles.segmentLabel}>{label}</span>
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          className={`${styles.toolButton} ${chatOpen ? styles.toolButtonActive : ''}`}
          onClick={() => updatePrefs({ chatOpen: !chatOpen })}
          aria-pressed={chatOpen}
          title="Live chat (C)"
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
          <button type="button" className={styles.toolButton} onClick={() => updatePrefs({ focusMode: true })} title="Focus mode (F)">
            <FocusIcon size={16} />
            <span className={styles.toolLabel}>Focus</span>
          </button>
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
  const { chatOpen, focusMode } = usePrefs();

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
      else if (key === 'f') updatePrefs({ focusMode: !focusMode });
      else if (key === 'escape' && focusMode) updatePrefs({ focusMode: false });
      else if (key === 'l') {
        const index = LAYOUTS.findIndex(l => l.id === layout);
        setLayout(LAYOUTS[(index + 1) % LAYOUTS.length].id);
      } else return;
      e.preventDefault();
    },
    [slots, layout, setLayout, toggleMuteAll, toggleSlotAudio, chatOpen, focusMode]
  );

  useEffect(() => {
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handler]);
}

/* ------------------------------------------------------- empty state */

function EmptyState() {
  return (
    <section className={styles.emptyState}>
      <div className={styles.emptyCard}>
        <span className={styles.eyebrow}>Multi-stream viewer</span>
        <h2 className={styles.emptyTitle}>Watch up to {SLOT_COUNT} streams at once.</h2>
        <p className={styles.emptyText}>
          Paste a link in the bar above to start. Mix live channels, VODs, and videos, follow the chat, and arrange everything exactly how you like.
        </p>
        <ul className={styles.platforms}>
          {(['youtube', 'twitch', 'kick', 'custom'] as const).map(p => (
            <li key={p} style={{ ['--platform' as string]: PLATFORM_META[p].color }}>
              <span className={styles.badgeDot} />
              {p === 'custom' ? 'Any iframe embed' : PLATFORM_META[p].name}
            </li>
          ))}
        </ul>
        <ol className={styles.steps}>
          <li>
            <strong>Add</strong>
            <span>Paste a channel or video URL and press Enter.</span>
          </li>
          <li>
            <strong>Arrange</strong>
            <span>Pick Stage, Spotlight, Theater, or Grid, then drag dividers to resize live.</span>
          </li>
          <li>
            <strong>Listen & chat</strong>
            <span>Choose the audio with 1-8 and open the live chat next to the streams.</span>
          </li>
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ page */

export function NowPlaying() {
  const { filledCount } = useVideo();
  const { chatOpen, focusMode } = usePrefs();
  const isNarrow = useMediaQuery('(max-width: 900px)');
  useKeyboardShortcuts();

  useEffect(() => {
    document.documentElement.classList.toggle('focus-mode', focusMode && !isNarrow);
    return () => document.documentElement.classList.remove('focus-mode');
  }, [focusMode, isNarrow]);

  const showChat = chatOpen && filledCount > 0;

  return (
    <main className={`${styles.container} ${focusMode && !isNarrow ? styles.focus : ''}`}>
      {!(focusMode && !isNarrow) && <Toolbar />}
      {focusMode && !isNarrow && (
        <button type="button" className={styles.exitFocus} onClick={() => updatePrefs({ focusMode: false })}>
          <CloseIcon size={14} />
          Exit focus <kbd>Esc</kbd>
        </button>
      )}
      {filledCount === 0 ? (
        <EmptyState />
      ) : (
        <div className={`${styles.workspace} ${isNarrow ? styles.workspaceStacked : ''}`}>
          <div className={styles.viewport}>
            <VideoGrid />
          </div>
          {showChat && <ChatPanel isNarrow={isNarrow} />}
        </div>
      )}
    </main>
  );
}
