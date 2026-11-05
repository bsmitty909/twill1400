import { useRef } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { updatePrefs, usePrefs } from '../../hooks/usePrefs';
import type { VideoSlot } from '../../types/index.ts';
import { useVideo } from '../../contexts/VideoContext';
import { getSourceUrl, PLATFORM_META } from '../../services/urlParser';
import { useStreamLabel } from '../../hooks/useStreamLabel';
import { YouTubePlayer } from '../Players/YouTubePlayer';
import { TwitchPlayer } from '../Players/TwitchPlayer';
import { KickPlayer } from '../Players/KickPlayer';
import { CustomPlayer } from '../Players/CustomPlayer';
import { ErrorBoundary } from '../ErrorBoundary';
import { DownloadButton } from './DownloadButton';
import { VolumeControl } from './VolumeControl';
import { CloseIcon, ExpandIcon, ExternalIcon, GridIcon, GripIcon, PlusIcon, SoloIcon, StarIcon, VolumeOnIcon } from '../Icons';
import styles from './NowPlaying.module.css';

interface VideoTileProps {
  slot: VideoSlot;
  compact?: boolean;
  /** Fixed 16:9 box (stacked/grid layouts) instead of filling its container. */
  aspect?: boolean;
  /** Slot currently in the main position; other tiles offer "Make main". */
  mainId?: number;
}

function Player({ slot, isMuted, volume }: { slot: VideoSlot; isMuted: boolean; volume: number }) {
  const { platform, videoId } = slot;
  if (!platform || !videoId) return null;
  switch (platform) {
    case 'youtube':
      return <YouTubePlayer videoId={videoId} isMuted={isMuted} volume={volume} />;
    case 'twitch':
      return <TwitchPlayer source={videoId} isMuted={isMuted} volume={volume} />;
    case 'kick':
      return <KickPlayer channel={videoId} isMuted={isMuted} />;
    case 'custom':
      return <CustomPlayer url={videoId} isMuted={isMuted} />;
  }
}

export function VideoTile({ slot, compact = false, aspect = false, mainId }: VideoTileProps) {
  const { audible, volumes, clearSlot, toggleSlotAudio, swapSlots } = useVideo();
  const { showLabels, soloSlot } = usePrefs();
  const tileRef = useRef<HTMLDivElement | null>(null);
  const filled = Boolean(slot.platform && slot.videoId);

  const { attributes, listeners, setNodeRef: setDragRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: slot.id,
    disabled: !filled,
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: slot.id });
  const { label, title: videoTitle } = useStreamLabel(slot.platform ?? 'custom', slot.videoId ?? '');

  const classes = [
    styles.tile,
    compact && styles.compact,
    aspect && styles.aspect,
    !filled && styles.empty,
    filled && audible.includes(slot.id) && styles.audible,
    isDragging && styles.dragging,
    isOver && !isDragging && styles.dropTarget,
  ]
    .filter(Boolean)
    .join(' ');

  if (!filled) {
    return (
      <div ref={setDropRef} className={classes}>
        <div className={styles.emptyInner}>
          <PlusIcon size={compact ? 16 : 22} />
          {!compact && <span>Slot {slot.id + 1} is open</span>}
          {compact && <span className={styles.emptyNumber}>{slot.id + 1}</span>}
        </div>
      </div>
    );
  }

  const platform = slot.platform!;
  const videoId = slot.videoId!;
  const meta = PLATFORM_META[platform];
  const isAudible = audible.includes(slot.id);
  const isSolo = soloSlot === slot.id;
  const canMakeMain = mainId !== undefined && mainId !== slot.id && !isSolo;

  /** Solo: this stream alone, full size, with its audio on. */
  const toggleSolo = () => {
    if (isSolo) {
      updatePrefs({ soloSlot: null });
      return;
    }
    if (!isAudible) toggleSlotAudio(slot.id);
    updatePrefs({ soloSlot: slot.id, focusMode: true });
  };

  function toggleFullscreen() {
    const el = tileRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => undefined);
  }

  return (
    <div
      ref={node => {
        tileRef.current = node;
        setDragRef(node);
        setDropRef(node);
      }}
      onDoubleClick={e => {
        if ((e.target as HTMLElement).closest('button, a')) return;
        toggleFullscreen();
      }}
      className={classes}
      style={{ ['--platform' as string]: meta.color }}
    >
      <div className={styles.player}>
        <ErrorBoundary>
          <Player slot={slot} isMuted={!isAudible} volume={volumes[slot.id]} />
        </ErrorBoundary>
      </div>

      <div className={styles.overlay}>
        <div className={styles.overlayLeft}>
          <button
            type="button"
            ref={setActivatorNodeRef}
            className={`${styles.iconButton} ${styles.grip}`}
            aria-label={`Move slot ${slot.id + 1}`}
            title="Drag to rearrange"
            {...attributes}
            {...listeners}
          >
            <GripIcon size={15} />
          </button>
          <span className={styles.badge}>
            <span className={styles.badgeDot} />
            {!compact && showLabels && <span className={styles.badgeText}>{meta.name}</span>}
          </span>
          {!compact && showLabels && (
            <span className={styles.label} title={videoTitle ? `${label} - ${videoTitle}` : label}>
              {label}
            </span>
          )}
        </div>
        <div className={styles.overlayRight}>
          <button
            type="button"
            className={`${styles.iconButton} ${isSolo ? styles.iconActive : ''}`}
            onClick={toggleSolo}
            aria-pressed={isSolo}
            aria-label={isSolo ? 'Show all streams' : `Solo slot ${slot.id + 1}`}
            title={isSolo ? 'Show all streams (Esc)' : 'Solo: watch only this stream (S)'}
          >
            {isSolo ? <GridIcon size={14} /> : <SoloIcon size={15} />}
          </button>
          {canMakeMain && (
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => swapSlots(slot.id, mainId!)}
              aria-label={`Make slot ${slot.id + 1} the main stream`}
              title="Make main stream"
            >
              <StarIcon size={14} />
            </button>
          )}
          <VolumeControl slot={slot} />
          {!compact && (
            <>
              <DownloadButton platform={platform} videoId={videoId} className={styles.iconButton} />
              <button
                type="button"
                className={styles.iconButton}
                onClick={toggleFullscreen}
                aria-label={`Fullscreen slot ${slot.id + 1}`}
                title="Fullscreen (double-click)"
              >
                <ExpandIcon size={14} />
              </button>
              <a
                className={styles.iconButton}
                href={getSourceUrl(platform, videoId)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open slot ${slot.id + 1} on ${meta.name}`}
                title={`Open on ${meta.name}`}
              >
                <ExternalIcon size={15} />
              </a>
            </>
          )}
          <button
            type="button"
            className={`${styles.iconButton} ${styles.remove}`}
            onClick={() => clearSlot(slot.id)}
            aria-label={`Remove slot ${slot.id + 1}`}
            title="Remove"
          >
            <CloseIcon size={15} />
          </button>
        </div>
      </div>

      {isAudible && (
        <span className={styles.audioPill}>
          <VolumeOnIcon size={12} />
          {!compact && 'Audio'}
        </span>
      )}
    </div>
  );
}
