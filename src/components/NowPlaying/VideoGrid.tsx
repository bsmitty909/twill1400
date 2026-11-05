import { useState } from 'react';
import Split from 'react-split';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { useVideo } from '../../contexts/VideoContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { getSlotLabel, PLATFORM_META } from '../../services/urlParser';
import { VideoTile } from './VideoTile';
import { GripIcon } from '../Icons';
import styles from './NowPlaying.module.css';
import './split-panes.css';

/*
 * Stage layout: slots 1-2 share the resizable main stage, 3-5 sit in the left
 * rail and 6-8 in the right rail. New streams fill slots in id order, so the
 * first two streams always land on the main stage.
 */
const STAGE_MAIN = [0, 1];
const STAGE_LEFT = [2, 3, 4];
const STAGE_RIGHT = [5, 6, 7];
const SIZES_KEY = 'twill:split:v1';
const DEFAULT_SIZES = { columns: [16, 68, 16], stage: [50, 50] };

function loadSizes(): typeof DEFAULT_SIZES {
  try {
    const saved = JSON.parse(localStorage.getItem(SIZES_KEY) ?? 'null');
    const valid = (a: unknown, n: number) => Array.isArray(a) && a.length === n && a.every(v => typeof v === 'number' && v > 0);
    if (saved && valid(saved.columns, 3) && valid(saved.stage, 2)) return saved;
  } catch {
    // Fall through to defaults.
  }
  return DEFAULT_SIZES;
}

function saveSizes(sizes: typeof DEFAULT_SIZES) {
  try {
    localStorage.setItem(SIZES_KEY, JSON.stringify(sizes));
  } catch {
    // Non-critical.
  }
}

const markDragging = () => document.documentElement.classList.add('is-dragging');
const unmarkDragging = () => document.documentElement.classList.remove('is-dragging');

function gridColumns(count: number): number {
  if (count <= 1) return 1;
  if (count <= 4) return 2;
  if (count <= 6) return 3;
  return 4;
}

function StageLayout() {
  const { slots } = useVideo();
  const [sizes] = useState(loadSizes);
  const rail = (ids: number[]) => (
    <div className={styles.rail}>
      {ids.map(id => (
        <VideoTile key={id} slot={slots[id]} compact />
      ))}
    </div>
  );

  return (
    <Split
      className={`split-horizontal ${styles.stage}`}
      direction="horizontal"
      sizes={sizes.columns}
      minSize={[110, 320, 110]}
      gutterSize={10}
      snapOffset={0}
      onDragStart={markDragging}
      onDragEnd={columns => {
        unmarkDragging();
        saveSizes({ ...loadSizes(), columns });
      }}
    >
      {rail(STAGE_LEFT)}
      <div className={styles.main}>
        <Split
          className="split-vertical"
          direction="vertical"
          sizes={sizes.stage}
          minSize={120}
          gutterSize={10}
          snapOffset={0}
          onDragStart={markDragging}
          onDragEnd={stage => {
            unmarkDragging();
            saveSizes({ ...loadSizes(), stage });
          }}
        >
          {STAGE_MAIN.map(id => (
            <div key={id} className={styles.mainCell}>
              <VideoTile slot={slots[id]} />
            </div>
          ))}
        </Split>
      </div>
      {rail(STAGE_RIGHT)}
    </Split>
  );
}

function GridLayout() {
  const { slots } = useVideo();
  const filled = slots.filter(s => s.platform);
  const columns = gridColumns(filled.length);
  return (
    <div
      className={styles.grid}
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${Math.ceil(filled.length / columns)}, minmax(0, 1fr))`,
      }}
    >
      {filled.map(slot => (
        <VideoTile key={slot.id} slot={slot} />
      ))}
    </div>
  );
}

function StackedLayout() {
  const { slots } = useVideo();
  return (
    <div className={styles.stack}>
      {slots
        .filter(s => s.platform)
        .map(slot => (
          <VideoTile key={slot.id} slot={slot} aspect />
        ))}
    </div>
  );
}

export function VideoGrid() {
  const { slots, layout, swapSlots } = useVideo();
  const isNarrow = useMediaQuery('(max-width: 900px)');
  const [draggingId, setDraggingId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const onDragStart = (event: DragStartEvent) => {
    setDraggingId(Number(event.active.id));
    markDragging();
  };

  const onDragEnd = (event: DragEndEvent) => {
    unmarkDragging();
    setDraggingId(null);
    const { active, over } = event;
    if (over && active.id !== over.id) swapSlots(Number(active.id), Number(over.id));
  };

  const onDragCancel = () => {
    unmarkDragging();
    setDraggingId(null);
  };

  const dragged = draggingId !== null ? slots[draggingId] : null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
      {isNarrow ? <StackedLayout /> : layout === 'grid' ? <GridLayout /> : <StageLayout />}
      <DragOverlay dropAnimation={null}>
        {dragged?.platform && dragged.videoId ? (
          <div className={styles.dragChip} style={{ ['--platform' as string]: PLATFORM_META[dragged.platform].color }}>
            <GripIcon size={14} />
            <span className={styles.badgeDot} />
            <span>
              Slot {dragged.id + 1} · {getSlotLabel(dragged.platform, dragged.videoId)}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
