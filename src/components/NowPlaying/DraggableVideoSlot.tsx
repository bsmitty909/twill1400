import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { VideoSlot as VideoSlotType } from '../../types/index.ts';
import { YouTubePlayer } from '../Players/YouTubePlayer';
import { TwitchPlayer } from '../Players/TwitchPlayer';
import { KickPlayer } from '../Players/KickPlayer';
import { useVideo } from '../../contexts/VideoContext';
import { ErrorBoundary } from '../ErrorBoundary';
import { DownloadButton } from './DownloadButton';
import styles from './NowPlaying.module.css';

interface DraggableVideoSlotProps {
  slot: VideoSlotType;
  isActive: boolean;
  onSlotClick: () => void;
}

export function DraggableVideoSlot({ slot, isActive, onSlotClick }: DraggableVideoSlotProps) {
  const { clearSlot, audioState } = useVideo();
  
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: slot.id,
    disabled: !slot.platform,
  });
  
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: slot.id,
  });

  const isMuted = audioState.muteAll || audioState.activeSlot !== slot.id;

  if (!slot.platform || !slot.videoId) {
    return (
      <div 
        ref={setDropRef}
        className={`${styles.videoSlot} ${isOver ? styles.dragOver : ''}`}
      >
        <div className={styles.emptySlot}>
          Slot {slot.id + 1}: Empty
        </div>
      </div>
    );
  }

  return (
    <div
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      className={`${styles.videoSlot} ${isActive ? styles.active : ''} ${isDragging ? styles.dragging : ''} ${isOver ? styles.dragOver : ''}`}
      {...attributes}
      {...listeners}
      style={{ cursor: slot.platform ? 'move' : 'default' }}
      onPointerDown={(e) => {
        if (slot.platform && e.target === e.currentTarget) {
          e.stopPropagation();
        }
      }}
      onClick={(e) => {
        if (!isDragging) {
          onSlotClick();
        }
      }}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        style={{
          position: 'absolute',
          top: '120px',
          left: '12px',
          width: '32px',
          height: '32px',
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(10px)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'move',
          zIndex: 10,
          fontSize: '1rem',
          color: 'white',
          border: '2px solid rgba(255, 255, 255, 0.2)'
        }}
        title="Drag to move video"
      >
        ⋮⋮
      </div>

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
      
      <DownloadButton
        platform={slot.platform}
        videoId={slot.videoId}
        slotId={slot.id}
      />
      
      <div className={styles.playerContainer}>
        <ErrorBoundary slotId={slot.id}>
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
        </ErrorBoundary>
      </div>
    </div>
  );
}
