import { useCallback, useEffect, useRef, useState } from 'react';
import { useBrowserFullscreen } from '../../hooks/useBrowserFullscreen';
import { useVideo } from '../../contexts/VideoContext';
import { updatePrefs, usePrefs } from '../../hooks/usePrefs';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useStreamLabel } from '../../hooks/useStreamLabel';
import { Mixer } from './VolumeControl';
import { PLATFORM_META } from '../../services/urlParser';
import type { LayoutMode, VideoSlot } from '../../types/index.ts';
import {
  ChatIcon,
  CloseIcon,
  GridIcon,
  MaximizeIcon,
  MinimizeIcon,
  SlidersIcon,
  SpotlightIcon,
  StageIcon,
  TheaterIcon,
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

const IDLE_MS = 2600;

function AudioChip({ slot }: { slot: VideoSlot }) {
  const { audible, toggleSlotAudio } = useVideo();
  const { label } = useStreamLabel(slot.platform!, slot.videoId!);
  const active = audible.includes(slot.id);
  return (
    <button
      type="button"
      className={`${styles.hudChip} ${active ? styles.hudChipActive : ''}`}
      style={{ ['--platform' as string]: PLATFORM_META[slot.platform!].color }}
      onClick={() => toggleSlotAudio(slot.id)}
      aria-pressed={active}
      title={`Listen only to ${label} (${slot.id + 1})`}
      aria-label={`Listen only to slot ${slot.id + 1}, ${label}`}
    >
      <span className={styles.badgeDot} />
      {slot.id + 1}
    </button>
  );
}

function SoloLabel({ slot }: { slot: VideoSlot }) {
  const { label } = useStreamLabel(slot.platform!, slot.videoId!);
  return <span className={styles.hudSoloName}>{label}</span>;
}

/*
 * Focus mode control strip. Everything but the streams (and chat, if open)
 * is hidden; this HUD slides up while the pointer moves, stays while it is
 * hovered or focused, and fades out after a short idle period so nothing
 * covers the video.
 */
export function FocusHud() {
  const { slots, layout, setLayout, audible, toggleMuteAll } = useVideo();
  const audioSlot = audible.length ? audible[0] : null;
  const [mixerOpen, setMixerOpen] = useState(false);
  const { chatOpen, soloSlot } = usePrefs();
  const isNarrow = useMediaQuery('(max-width: 900px)');
  const fullscreen = useBrowserFullscreen();
  const [visible, setVisible] = useState(true);
  const hovering = useRef(false);
  const timer = useRef<number>(0);

  const wake = useCallback(() => {
    setVisible(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (!hovering.current) setVisible(false);
    }, IDLE_MS);
  }, []);

  useEffect(() => {
    // Starts visible; just arm the idle timer.
    timer.current = window.setTimeout(() => {
      if (!hovering.current) setVisible(false);
    }, IDLE_MS);
    const events = ['pointermove', 'pointerdown', 'keydown', 'touchstart'] as const;
    events.forEach(e => window.addEventListener(e, wake, { passive: true }));
    return () => {
      events.forEach(e => window.removeEventListener(e, wake));
      window.clearTimeout(timer.current);
    };
  }, [wake]);

  const filled = slots.filter(s => s.platform && s.videoId);
  const solo = soloSlot !== null ? slots[soloSlot] : null;
  const soloActive = Boolean(solo?.platform);

  const exit = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    updatePrefs({ focusMode: false, soloSlot: null });
  };

  return (
    <>
      {/*
        Video iframes swallow pointer events, so moving over a stream can't
        wake the HUD. A thin bottom-edge strip and a small "Controls" tab
        (both outside the players' own control areas) bring it back.
      */}
      {!visible && (
        <>
          <div className={styles.hudEdge} onPointerEnter={wake} onPointerMove={wake} aria-hidden="true" />
          <button type="button" className={styles.hudTab} onPointerEnter={wake} onClick={wake} aria-label="Show focus controls">
            <span className={styles.led} aria-hidden="true" />
            Controls
          </button>
        </>
      )}
    <div
      className={`${styles.hud} ${visible ? styles.hudVisible : ''}`}
      role="toolbar"
      aria-label="Focus mode controls"
      onPointerEnter={() => {
        hovering.current = true;
        wake();
      }}
      onPointerLeave={() => {
        hovering.current = false;
        wake();
      }}
      onFocus={wake}
    >
      {mixerOpen && (
        <div className={styles.hudMixer} role="dialog" aria-label="Volume mixer">
          <Mixer />
        </div>
      )}
      <div className={styles.hudSection}>
        <span className={styles.led} aria-hidden="true" />
        <span className="tag">{soloActive ? 'Solo' : 'Focus'}</span>
        <span className={styles.hudCount}>{filled.length} CH</span>
      </div>

      {soloActive && solo ? (
        <div className={styles.hudSection}>
          <span className={styles.badgeDot} style={{ ['--platform' as string]: PLATFORM_META[solo.platform!].color }} />
          <SoloLabel slot={solo} />
          <button type="button" className={styles.hudButton} onClick={() => updatePrefs({ soloSlot: null })} title="Show all streams (Esc)">
            <GridIcon size={15} />
            <span>All streams</span>
          </button>
        </div>
      ) : (
        !isNarrow && (
          <div className={styles.hudSection} role="radiogroup" aria-label="Layout">
            {LAYOUTS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={layout === id}
                aria-label={label}
                title={label}
                className={`${styles.hudIcon} ${layout === id ? styles.hudIconActive : ''}`}
                onClick={() => setLayout(id)}
              >
                <Icon size={16} />
              </button>
            ))}
          </div>
        )
      )}

      <div className={styles.hudSection}>
        <button
          type="button"
          className={`${styles.hudIcon} ${audioSlot !== null ? styles.hudIconActive : ''}`}
          onClick={toggleMuteAll}
          aria-label={audioSlot === null ? 'Unmute' : 'Mute all'}
          title={audioSlot === null ? 'Unmute (M)' : 'Mute all (M)'}
        >
          {audioSlot === null ? <VolumeOffIcon size={16} /> : <VolumeOnIcon size={16} />}
        </button>
        {filled.map(slot => (
          <AudioChip key={slot.id} slot={slot} />
        ))}
        <button
          type="button"
          className={`${styles.hudIcon} ${mixerOpen ? styles.hudIconActive : ''}`}
          onClick={() => setMixerOpen(o => !o)}
          aria-expanded={mixerOpen}
          aria-label="Volume mixer"
          title="Volume mixer"
        >
          <SlidersIcon size={16} />
        </button>
      </div>

      <div className={styles.hudSection}>
        <button
          type="button"
          className={`${styles.hudIcon} ${chatOpen ? styles.hudIconActive : ''}`}
          onClick={() => updatePrefs({ chatOpen: !chatOpen })}
          aria-pressed={chatOpen}
          aria-label="Chat"
          title="Chat (C)"
        >
          <ChatIcon size={16} />
        </button>
        {fullscreen.supported && (
          <button
            type="button"
            className={`${styles.hudIcon} ${fullscreen.active ? styles.hudIconActive : ''}`}
            onClick={fullscreen.toggle}
            aria-pressed={fullscreen.active}
            aria-label={fullscreen.active ? 'Exit full screen' : 'Full screen'}
            title={fullscreen.active ? 'Exit full screen' : 'Full screen'}
          >
            {fullscreen.active ? <MinimizeIcon size={16} /> : <MaximizeIcon size={16} />}
          </button>
        )}
        <button type="button" className={`${styles.hudButton} ${styles.hudExit}`} onClick={exit} title="Exit focus (Esc)">
          <CloseIcon size={14} />
          <span>Exit</span>
          <kbd>Esc</kbd>
        </button>
      </div>
    </div>
    </>
  );
}
