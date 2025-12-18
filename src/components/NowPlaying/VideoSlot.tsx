import React from 'react';
import type { VideoSlot as VideoSlotType } from '../../types/index.ts';
import { YouTubePlayer } from '../Players/YouTubePlayer';
import { TwitchPlayer } from '../Players/TwitchPlayer';
import { KickPlayer } from '../Players/KickPlayer';
import { useVideo } from '../../contexts/VideoContext';
import styles from './NowPlaying.module.css';

interface VideoSlotProps {
  slot: VideoSlotType;
  isActive: boolean;
  onSlotClick: () => void;
}

export function VideoSlot({ slot, isActive, onSlotClick }: VideoSlotProps) {
  const { clearSlot, audioState } = useVideo();

  const isMuted = audioState.muteAll || audioState.activeSlot !== slot.id;

  if (!slot.platform || !slot.videoId) {
    return (
      <div className={styles.videoSlot}>
        <div className={styles.emptySlot}>
          Slot {slot.id + 1}: Empty
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${styles.videoSlot} ${isActive ? styles.active : ''}`}
      onClick={onSlotClick}
    >
      <button
        className={styles.closeButton}
        onClick={(e) => {
          e.stopPropagation();
          clearSlot(slot.id);
        }}
        title="Clear slot"
      >
        ✕
      </button>
      
      <div className={styles.playerContainer}>
        {slot.platform === 'youtube' && (
          <YouTubePlayer
            videoId={slot.videoId}
            isMuted={isMuted}
          />
        )}
        
        {slot.platform === 'twitch' && (
          <TwitchPlayer
            channel={slot.videoId}
            isMuted={isMuted}
          />
        )}
        
        {slot.platform === 'kick' && (
          <KickPlayer
            channel={slot.videoId}
            isMuted={isMuted}
          />
        )}
      </div>
    </div>
  );
}
