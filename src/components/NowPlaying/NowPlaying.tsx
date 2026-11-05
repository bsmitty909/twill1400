import { useEffect, useState } from 'react';
import { useVideo, SLOT_COUNT } from '../../contexts/VideoContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { PLATFORM_META } from '../../services/urlParser';
import type { LayoutMode } from '../../types/index.ts';
import { VideoGrid } from './VideoGrid';
import { GridIcon, StageIcon, TrashIcon, VolumeOffIcon, VolumeOnIcon } from '../Icons';
import styles from './NowPlaying.module.css';

const LAYOUTS: { id: LayoutMode; label: string; Icon: typeof StageIcon }[] = [
  { id: 'stage', label: 'Stage', Icon: StageIcon },
  { id: 'grid', label: 'Grid', Icon: GridIcon },
];

function Toolbar() {
  const { slots, filledCount, audioSlot, layout, setLayout, toggleMuteAll, toggleSlotAudio, clearAll } = useVideo();
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
        >
          {audioSlot === null ? <VolumeOffIcon size={16} /> : <VolumeOnIcon size={16} />}
          <span>{audioSlot === null ? 'Unmute' : 'Mute all'}</span>
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
                title={slot.platform ? `Slot ${slot.id + 1} - ${PLATFORM_META[slot.platform].name}` : `Slot ${slot.id + 1} - empty`}
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
              >
                <Icon size={15} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          className={`${styles.toolButton} ${confirmClear ? styles.toolButtonDanger : ''}`}
          onClick={handleClear}
          disabled={filledCount === 0}
        >
          <TrashIcon size={16} />
          <span>{confirmClear ? 'Click to confirm' : 'Clear all'}</span>
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <section className={styles.emptyState}>
      <div className={styles.emptyCard}>
        <span className={styles.eyebrow}>Multi-stream viewer</span>
        <h2 className={styles.emptyTitle}>Watch up to {SLOT_COUNT} streams at once.</h2>
        <p className={styles.emptyText}>
          Paste a link in the bar above to start. Mix live channels, VODs, and videos, then rearrange and resize them however you like.
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
            <strong>Listen</strong>
            <span>Pick which single stream plays audio with the speaker icon.</span>
          </li>
          <li>
            <strong>Arrange</strong>
            <span>Drag tiles by the grip to swap them, and drag dividers to resize.</span>
          </li>
        </ol>
      </div>
    </section>
  );
}

export function NowPlaying() {
  const { filledCount } = useVideo();
  return (
    <main className={styles.container}>
      <Toolbar />
      {filledCount === 0 ? (
        <EmptyState />
      ) : (
        <div className={styles.viewport}>
          <VideoGrid />
        </div>
      )}
    </main>
  );
}
