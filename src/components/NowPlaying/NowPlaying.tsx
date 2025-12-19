import { useVideo } from '../../contexts/VideoContext';
import { VideoGrid } from './VideoGrid';
import styles from './NowPlaying.module.css';

export function NowPlaying() {
  const { slots, audioState, setActiveAudioSlot, toggleMuteAll } = useVideo();

  const handleSlotClick = (slotId: number) => {
    const slot = slots.find(s => s.id === slotId);
    if (slot && slot.platform) {
      if (audioState.activeSlot === slotId) {
        setActiveAudioSlot(null);
      } else {
        setActiveAudioSlot(slotId);
      }
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Now Playing</h2>
      
      <div className={styles.audioControls}>
        <button
          className={`${styles.muteAllButton} ${audioState.muteAll ? styles.muted : ''}`}
          onClick={toggleMuteAll}
        >
          {audioState.muteAll ? '🔇 UNMUTE ALL' : '🔊 MUTE ALL'}
        </button>
        
        <div className={styles.slotButtons}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Audio:
          </span>
          {slots.slice(0, 8).map((slot) => (
            <button
              key={slot.id}
              className={`${styles.slotButton} ${
                audioState.activeSlot === slot.id ? styles.active : ''
              }`}
              onClick={() => handleSlotClick(slot.id)}
              disabled={!slot.platform}
              title={`Slot ${slot.id + 1}${
                audioState.activeSlot === slot.id ? ' (Active)' : ''
              }`}
            >
              {slot.id + 1}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.gridContainer}>
        <VideoGrid />
      </div>
    </div>
  );
}
