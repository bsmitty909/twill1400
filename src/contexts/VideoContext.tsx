import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { VideoSlot, AudioState } from '../types/index.ts';

interface VideoContextType {
  slots: VideoSlot[];
  audioState: AudioState;
  addVideo: (platform: string, videoId: string) => void;
  clearSlot: (slotId: number) => void;
  setActiveAudioSlot: (slotId: number | null) => void;
  toggleMuteAll: () => void;
}

const VideoContext = createContext<VideoContextType | undefined>(undefined);

export function VideoProvider({ children }: { children: ReactNode }) {
  const [slots, setSlots] = useState<VideoSlot[]>([
    { id: 0, platform: null, videoId: null },
    { id: 1, platform: null, videoId: null },
    { id: 2, platform: null, videoId: null },
    { id: 3, platform: null, videoId: null },
  ]);

  const [audioState, setAudioState] = useState<AudioState>({
    activeSlot: null,
    muteAll: true,
  });

  const addVideo = (platform: string, videoId: string) => {
    const emptySlot = slots.find(slot => slot.platform === null);
    if (emptySlot) {
      setSlots(prev =>
        prev.map(slot =>
          slot.id === emptySlot.id
            ? { ...slot, platform: platform as any, videoId }
            : slot
        )
      );
    }
  };

  const clearSlot = (slotId: number) => {
    setSlots(prev =>
      prev.map(slot =>
        slot.id === slotId
          ? { ...slot, platform: null, videoId: null }
          : slot
      )
    );
    
    if (audioState.activeSlot === slotId) {
      setAudioState(prev => ({ ...prev, activeSlot: null }));
    }
  };

  const setActiveAudioSlot = (slotId: number | null) => {
    setAudioState({
      activeSlot: slotId,
      muteAll: slotId === null,
    });
  };

  const toggleMuteAll = () => {
    setAudioState(prev => ({
      ...prev,
      muteAll: !prev.muteAll,
      activeSlot: prev.muteAll ? prev.activeSlot : null,
    }));
  };

  return (
    <VideoContext.Provider
      value={{
        slots,
        audioState,
        addVideo,
        clearSlot,
        setActiveAudioSlot,
        toggleMuteAll,
      }}
    >
      {children}
    </VideoContext.Provider>
  );
}

export function useVideo() {
  const context = useContext(VideoContext);
  if (context === undefined) {
    throw new Error('useVideo must be used within a VideoProvider');
  }
  return context;
}
