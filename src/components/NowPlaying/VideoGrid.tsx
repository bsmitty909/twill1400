import Split from 'react-split';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { DraggableVideoSlot } from './DraggableVideoSlot';
import { useVideo } from '../../contexts/VideoContext';
import './split-panes.css';

export function VideoGrid() {
  const { slots, audioState, setActiveAudioSlot, swapSlots } = useVideo();

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const fromId = Number(active.id);
      const toId = Number(over.id);
      swapSlots(fromId, toId);
    }
  };

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div style={{ display: 'flex', height: '100%', gap: '1rem' }}>
        {/* Left Sidebar - 3 smaller slots */}
        <div style={{ width: '15%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[0, 1, 2].map((slotId) => (
            <div key={slotId} style={{ flex: 1 }}>
              <DraggableVideoSlot
                slot={slots[slotId]}
                isActive={audioState.activeSlot === slotId && !audioState.muteAll}
                onSlotClick={() => handleSlotClick(slotId)}
              />
            </div>
          ))}
        </div>

        {/* Main Stage - 2 large slots with horizontal slider */}
        <div style={{ flex: 1 }}>
          <Split
            className="split-vertical"
            direction="vertical"
            sizes={[50, 50]}
            minSize={100}
            gutterSize={8}
            style={{ display: 'flex', height: '100%', width: '100%' }}
          >
            <div style={{ height: '100%', overflow: 'hidden' }}>
              <DraggableVideoSlot
                slot={slots[3]}
                isActive={audioState.activeSlot === 3 && !audioState.muteAll}
                onSlotClick={() => handleSlotClick(3)}
              />
            </div>
            <div style={{ height: '100%', overflow: 'hidden' }}>
              <DraggableVideoSlot
                slot={slots[4]}
                isActive={audioState.activeSlot === 4 && !audioState.muteAll}
                onSlotClick={() => handleSlotClick(4)}
              />
            </div>
          </Split>
        </div>

        {/* Right Sidebar - 3 smaller slots */}
        <div style={{ width: '15%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[5, 6, 7].map((slotId) => (
            <div key={slotId} style={{ flex: 1 }}>
              <DraggableVideoSlot
                slot={slots[slotId]}
                isActive={audioState.activeSlot === slotId && !audioState.muteAll}
                onSlotClick={() => handleSlotClick(slotId)}
              />
            </div>
          ))}
        </div>
      </div>
    </DndContext>
  );
}
