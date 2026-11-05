import { useVideo } from '../../contexts/VideoContext';
import { useStreamLabel } from '../../hooks/useStreamLabel';
import { PLATFORM_META, supportsVolume } from '../../services/urlParser';
import type { VideoSlot } from '../../types/index.ts';
import { VolumeOffIcon, VolumeOnIcon } from '../Icons';
import styles from './NowPlaying.module.css';

interface SliderProps {
  slot: VideoSlot;
  label: string;
}

/** Square industrial volume slider with a filled track and live % readout. */
export function VolumeSlider({ slot, label }: SliderProps) {
  const { audible, volumes, setSlotVolume } = useVideo();
  const enabled = supportsVolume(slot.platform!);
  const on = audible.includes(slot.id);
  const level = on ? volumes[slot.id] : 0;

  if (!enabled) {
    return <span className={styles.volumeNote}>{PLATFORM_META[slot.platform!].name}: on/off only</span>;
  }

  return (
    <span className={styles.volumeSliderWrap}>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={level}
        onChange={e => setSlotVolume(slot.id, Number(e.target.value))}
        className={styles.volumeSlider}
        aria-label={`Volume for ${label}`}
        aria-valuetext={on ? `${level}%` : 'Muted'}
      />
      <span className={styles.volumeValue}>{on ? level : 'MUTE'}</span>
    </span>
  );
}

/**
 * Speaker button for one tile: click toggles this stream's sound (others
 * keep playing, so streams can be mixed); hovering or focusing reveals the
 * slider.
 */
export function VolumeControl({ slot }: { slot: VideoSlot }) {
  const { audible, toggleSlotMute } = useVideo();
  const { label } = useStreamLabel(slot.platform!, slot.videoId!);
  const on = audible.includes(slot.id);

  return (
    <div className={styles.volumeGroup}>
      <button
        type="button"
        className={`${styles.iconButton} ${on ? styles.iconActive : ''}`}
        onClick={() => toggleSlotMute(slot.id)}
        aria-pressed={on}
        aria-label={on ? `Mute ${label}` : `Unmute ${label}`}
        title={on ? 'Mute this stream' : 'Unmute this stream'}
      >
        {on ? <VolumeOnIcon size={15} /> : <VolumeOffIcon size={15} />}
      </button>
      <div className={styles.volumePop}>
        <VolumeSlider slot={slot} label={label} />
      </div>
    </div>
  );
}

function MixerRow({ slot }: { slot: VideoSlot }) {
  const { audible, toggleSlotMute } = useVideo();
  const { label } = useStreamLabel(slot.platform!, slot.videoId!);
  const on = audible.includes(slot.id);
  return (
    <li className={styles.mixerRow} style={{ ['--platform' as string]: PLATFORM_META[slot.platform!].color }}>
      <span className={styles.mixerSlot}>{slot.id + 1}</span>
      <span className={styles.badgeDot} />
      <span className={styles.mixerName} title={label}>
        {label}
      </span>
      <button
        type="button"
        className={`${styles.mixerMute} ${on ? styles.mixerMuteOn : ''}`}
        onClick={() => toggleSlotMute(slot.id)}
        aria-pressed={on}
        aria-label={on ? `Mute ${label}` : `Unmute ${label}`}
      >
        {on ? <VolumeOnIcon size={14} /> : <VolumeOffIcon size={14} />}
      </button>
      <VolumeSlider slot={slot} label={label} />
    </li>
  );
}

/** Every stream's volume in one place. */
export function Mixer() {
  const { slots, audible, toggleMuteAll } = useVideo();
  const filled = slots.filter(s => s.platform && s.videoId);
  return (
    <div className={styles.mixer}>
      <div className={styles.mixerHeader}>
        <span className="tag">Mixer · {audible.length} live</span>
        <button type="button" className={styles.linkButton} onClick={toggleMuteAll}>
          {audible.length ? 'Mute all' : 'Unmute'}
        </button>
      </div>
      {filled.length ? (
        <ul className={styles.mixerList}>
          {filled.map(slot => (
            <MixerRow key={slot.id} slot={slot} />
          ))}
        </ul>
      ) : (
        <p className={styles.hint}>Add a stream to control its volume.</p>
      )}
      <p className={styles.hint}>Several streams can play at once. Keys 1-8 still switch to just one.</p>
    </div>
  );
}
