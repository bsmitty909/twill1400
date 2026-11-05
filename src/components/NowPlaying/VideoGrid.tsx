import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import Split from 'react-split';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { useVideo } from '../../contexts/VideoContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { updateSizes, usePrefs } from '../../hooks/usePrefs';
import type { Prefs } from '../../hooks/usePrefs';
import { PLATFORM_META } from '../../services/urlParser';
import { StreamLabel } from '../StreamLabel';
import type { VideoSlot } from '../../types/index.ts';
import { VideoTile } from './VideoTile';
import { GripIcon, PlusIcon } from '../Icons';
import styles from './NowPlaying.module.css';
import './split-panes.css';

/*
 * Layouts
 *
 *   stage     - slots 1-2 share the resizable main stage, 3-5 left rail, 6-8 right rail
 *   spotlight - first stream large, the rest in a resizable column on the right
 *   theater   - first stream large, the rest in a resizable strip underneath
 *   grid      - equal tiles; column count automatic or fixed via Customize
 *
 * Every divider resizes live and its position is remembered per layout.
 * While a divider or tile is dragged, iframes ignore the pointer so the drag
 * never gets "stuck" over a video.
 */

const STAGE_MAIN = [0, 1];
const STAGE_LEFT = [2, 3, 4];
const STAGE_RIGHT = [5, 6, 7];

const markDragging = () => document.documentElement.classList.add('is-dragging');
const unmarkDragging = () => document.documentElement.classList.remove('is-dragging');

function autoColumns(count: number): number {
  if (count <= 1) return 1;
  if (count <= 4) return 2;
  if (count <= 6) return 3;
  return 4;
}

interface ResizableProps {
  name: keyof Prefs['sizes'];
  direction: 'horizontal' | 'vertical';
  minSize: number | number[];
  className?: string;
  children: ReactNode;
}

function Resizable({ name, direction, minSize, className = '', children }: ResizableProps) {
  const prefs = usePrefs();
  return (
    <Split
      className={`${direction === 'horizontal' ? 'split-horizontal' : 'split-vertical'} ${className}`}
      direction={direction}
      sizes={prefs.sizes[name]}
      minSize={minSize}
      gutterSize={Math.max(prefs.gap, 8)}
      snapOffset={0}
      onDragStart={markDragging}
      onDragEnd={sizes => {
        unmarkDragging();
        updateSizes(name, sizes);
      }}
    >
      {children}
    </Split>
  );
}

function AddHint({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`${styles.addHint} ${compact ? styles.addHintCompact : ''}`}>
      <PlusIcon size={16} />
      <span>Add more streams to fill this space</span>
    </div>
  );
}

function StageLayout({ slots, mainId }: LayoutProps) {
  const rail = (ids: number[]) => (
    <div className={styles.rail}>
      {ids.map(id => (
        <VideoTile key={id} slot={slots[id]} compact mainId={mainId} />
      ))}
    </div>
  );
  return (
    <Resizable name="stageColumns" direction="horizontal" minSize={[110, 320, 110]} className={styles.fill}>
      {rail(STAGE_LEFT)}
      <div className={styles.fill}>
        <Resizable name="stageMain" direction="vertical" minSize={120}>
          {STAGE_MAIN.map(id => (
            <div key={id} className={styles.fill}>
              <VideoTile slot={slots[id]} mainId={mainId} />
            </div>
          ))}
        </Resizable>
      </div>
      {rail(STAGE_RIGHT)}
    </Resizable>
  );
}

interface LayoutProps {
  slots: VideoSlot[];
  mainId: number;
}

function SpotlightLayout({ slots, mainId }: LayoutProps) {
  const filled = slots.filter(s => s.platform);
  const others = filled.filter(s => s.id !== mainId);
  return (
    <Resizable name="spotlight" direction="horizontal" minSize={[320, 150]} className={styles.fill}>
      <div className={styles.fill}>
        <VideoTile slot={slots[mainId]} mainId={mainId} />
      </div>
      <div className={styles.column}>
        {others.length ? others.map(s => <VideoTile key={s.id} slot={s} compact mainId={mainId} />) : <AddHint compact />}
      </div>
    </Resizable>
  );
}

function TheaterLayout({ slots, mainId }: LayoutProps) {
  const filled = slots.filter(s => s.platform);
  const others = filled.filter(s => s.id !== mainId);
  return (
    <Resizable name="theater" direction="vertical" minSize={[200, 90]} className={styles.fill}>
      <div className={styles.fill}>
        <VideoTile slot={slots[mainId]} mainId={mainId} />
      </div>
      <div className={styles.strip}>
        {others.length ? others.map(s => <VideoTile key={s.id} slot={s} compact mainId={mainId} />) : <AddHint compact />}
      </div>
    </Resizable>
  );
}

function GridLayout({ slots, mainId }: LayoutProps) {
  const { gridColumns } = usePrefs();
  const filled = slots.filter(s => s.platform);
  const columns = Math.min(gridColumns === 'auto' ? autoColumns(filled.length) : gridColumns, Math.max(filled.length, 1));
  return (
    <div
      className={styles.grid}
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${Math.ceil(filled.length / columns)}, minmax(0, 1fr))`,
      }}
    >
      {filled.map(slot => (
        <VideoTile key={slot.id} slot={slot} mainId={mainId} />
      ))}
    </div>
  );
}

function StackedLayout({ slots, mainId }: LayoutProps) {
  return (
    <div className={styles.stack}>
      {slots
        .filter(s => s.platform)
        .map(slot => (
          <VideoTile key={slot.id} slot={slot} aspect mainId={mainId} />
        ))}
    </div>
  );
}

export function VideoGrid() {
  const { slots, layout, swapSlots } = useVideo();
  const { gap } = usePrefs();
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

  // Stage always treats slot 1 as main; other layouts use the first stream.
  const mainId = layout === 'stage' ? 0 : (slots.find(s => s.platform)?.id ?? 0);
  const props = { slots, mainId };
  const dragged = draggingId !== null ? slots[draggingId] : null;

  let content: ReactNode;
  if (isNarrow) content = <StackedLayout {...props} />;
  else if (layout === 'spotlight') content = <SpotlightLayout {...props} />;
  else if (layout === 'theater') content = <TheaterLayout {...props} />;
  else if (layout === 'grid') content = <GridLayout {...props} />;
  else content = <StageLayout {...props} />;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
      <div className={styles.layoutRoot} style={{ '--gap': `${gap}px` } as CSSProperties}>
        {content}
      </div>
      <DragOverlay dropAnimation={null}>
        {dragged?.platform && dragged.videoId ? (
          <div className={styles.dragChip} style={{ ['--platform' as string]: PLATFORM_META[dragged.platform].color }}>
            <GripIcon size={14} />
            <span className={styles.badgeDot} />
            <span>
              Slot {dragged.id + 1} · <StreamLabel platform={dragged.platform} videoId={dragged.videoId} />
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
