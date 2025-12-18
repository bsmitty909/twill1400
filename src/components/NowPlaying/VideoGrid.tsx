import Split from 'react-split';
import { VideoSlot } from './VideoSlot';
import { useVideo } from '../../contexts/VideoContext';
import './split-panes.css';

export function VideoGrid() {
  const { slots, audioState, setActiveAudioSlot } = useVideo();

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
    <Split
      className="split-vertical"
      direction="vertical"
      sizes={[50, 50]}
      minSize={100}
      gutterSize={8}
      style={{ display: 'flex', height: '100%', width: '100%' }}
    >
      <Split
        className="split-horizontal"
        direction="horizontal"
        sizes={[50, 50]}
        minSize={100}
        gutterSize={8}
        style={{ display: 'flex', height: '100%', width: '100%' }}
      >
        <div style={{ height: '100%', overflow: 'hidden' }}>
          <VideoSlot
            slot={slots[0]}
            isActive={audioState.activeSlot === 0 && !audioState.muteAll}
            onSlotClick={() => handleSlotClick(0)}
          />
        </div>
        <div style={{ height: '100%', overflow: 'hidden' }}>
          <VideoSlot
            slot={slots[1]}
            isActive={audioState.activeSlot === 1 && !audioState.muteAll}
            onSlotClick={() => handleSlotClick(1)}
          />
        </div>
      </Split>

      <Split
        className="split-horizontal"
        direction="horizontal"
        sizes={[50, 50]}
        minSize={100}
        gutterSize={8}
        style={{ display: 'flex', height: '100%', width: '100%' }}
      >
        <div style={{ height: '100%', overflow: 'hidden' }}>
          <VideoSlot
            slot={slots[2]}
            isActive={audioState.activeSlot === 2 && !audioState.muteAll}
            onSlotClick={() => handleSlotClick(2)}
          />
        </div>
        <div style={{ height: '100%', overflow: 'hidden' }}>
          <VideoSlot
            slot={slots[3]}
            isActive={audioState.activeSlot === 3 && !audioState.muteAll}
            onSlotClick={() => handleSlotClick(3)}
          />
        </div>
      </Split>
    </Split>
  );
}
