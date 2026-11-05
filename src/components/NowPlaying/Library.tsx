import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useVideo } from '../../contexts/VideoContext';
import {
  buildShareUrl,
  clearShareFromUrl,
  deleteSetup,
  readSharedSetup,
  saveSetup,
  useLibrary,
} from '../../services/library';
import type { SavedSetup, StreamRef } from '../../services/library';
import { PLATFORM_META } from '../../services/urlParser';
import { useStreamLabel } from '../../hooks/useStreamLabel';
import { CheckIcon, CloseIcon, ShareIcon, TrashIcon } from '../Icons';
import styles from './NowPlaying.module.css';

export type Notify = (tone: 'success' | 'error', text: string) => void;

const LAYOUT_NAMES = { stage: 'Stage', spotlight: 'Spotlight', theater: 'Theater', grid: 'Grid' } as const;

export function StreamChip({ stream, onClick, onRemove }: { stream: StreamRef; onClick?: () => void; onRemove?: () => void }) {
  const { label, title } = useStreamLabel(stream.platform, stream.videoId);
  const describe = `${PLATFORM_META[stream.platform].name} · ${label}`;
  return (
    <span className={styles.streamChip} style={{ ['--platform' as string]: PLATFORM_META[stream.platform].color }}>
      <button type="button" className={styles.streamChipMain} onClick={onClick} title={title ? `Add ${describe} - ${title}` : `Add ${describe}`} disabled={!onClick}>
        <span className={styles.badgeDot} />
        <span className={styles.streamChipName}>{label}</span>
        <span className={styles.streamChipPlatform}>{PLATFORM_META[stream.platform].name}</span>
      </button>
      {onRemove && (
        <button type="button" className={styles.streamChipRemove} onClick={onRemove} aria-label={`Forget ${describe}`}>
          <CloseIcon size={12} />
        </button>
      )}
    </span>
  );
}

/* ------------------------------------------------------------- share */

export function ShareButton({ notify }: { notify: Notify }) {
  const { slots, layout, filledCount } = useVideo();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  const share = async () => {
    const url = buildShareUrl(layout, slots);
    try {
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: 'TWill multi-stream', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      notify('success', 'Share link copied. Anyone with it can open this exact setup.');
    } catch (error) {
      if ((error as Error).name !== 'AbortError') notify('error', 'Could not copy the link. Your browser blocked clipboard access.');
    }
  };

  return (
    <button
      type="button"
      className={styles.toolButton}
      onClick={share}
      disabled={filledCount === 0}
      title="Copy a link to this setup"
      aria-label={copied ? 'Copied' : 'Share'}
    >
      {copied ? <CheckIcon size={16} /> : <ShareIcon size={16} />}
      <span className={styles.toolLabel}>{copied ? 'Copied' : 'Share'}</span>
    </button>
  );
}

/* ------------------------------------------------------------ setups */

export function SetupList({ setups, notify, compact = false }: { setups: SavedSetup[]; notify: Notify; compact?: boolean }) {
  const { loadSetup } = useVideo();
  if (!setups.length) return <p className={styles.hint}>No saved setups yet.</p>;
  return (
    <ul className={compact ? styles.setupListCompact : styles.setupList}>
      {setups.map(setup => (
        <li key={setup.id} className={styles.setupItem}>
          <button
            type="button"
            className={styles.setupLoad}
            onClick={() => {
              loadSetup(setup.streams, setup.layout);
              notify('success', `Loaded "${setup.name}".`);
            }}
          >
            <span className={styles.setupName}>{setup.name}</span>
            <span className={styles.setupMeta}>
              {setup.streams.length} stream{setup.streams.length === 1 ? '' : 's'} · {LAYOUT_NAMES[setup.layout]}
            </span>
            <span className={styles.setupDots} aria-hidden="true">
              {setup.streams.map((s, i) => (
                <span key={i} className={styles.badgeDot} style={{ ['--platform' as string]: PLATFORM_META[s.platform].color }} />
              ))}
            </span>
          </button>
          <button type="button" className={styles.setupDelete} onClick={() => deleteSetup(setup.id)} aria-label={`Delete setup ${setup.name}`}>
            <TrashIcon size={14} />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function SetupsPanel({ notify }: { notify: Notify }) {
  const { slots, layout, filledCount } = useVideo();
  const { setups } = useLibrary();
  const [name, setName] = useState('');

  const save = (e: FormEvent) => {
    e.preventDefault();
    const setup = saveSetup(name, layout, slots);
    setName('');
    notify('success', `Saved "${setup.name}".`);
  };

  return (
    <div className={styles.customize}>
      <form className={styles.saveForm} onSubmit={save}>
        <span className={styles.fieldLabel}>Save current setup</span>
        <div className={styles.saveRow}>
          <input
            className={styles.textInput}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Friday raid night"
            maxLength={60}
            aria-label="Setup name"
            disabled={filledCount === 0}
          />
          <button type="submit" className={styles.saveButton} disabled={filledCount === 0}>
            Save
          </button>
        </div>
        {filledCount === 0 && <p className={styles.hint}>Add a stream first, then save the arrangement.</p>}
      </form>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>Saved setups</span>
        <SetupList setups={setups} notify={notify} compact />
      </div>
    </div>
  );
}

/* ---------------------------------------------------- shared link banner */

/*
 * A shared link never replaces the viewer's current streams silently: the
 * banner lists exactly what will load (including any custom embed hosts)
 * and waits for an explicit choice.
 */
export function SharedSetupBanner({ notify }: { notify: Notify }) {
  const { loadSetup, addVideos, filledCount } = useVideo();
  const [shared, setShared] = useState(readSharedSetup);

  useEffect(() => {
    const onHash = () => setShared(readSharedSetup());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (!shared) return null;

  const close = () => {
    clearShareFromUrl();
    setShared(null);
  };

  return (
    <div className={styles.sharedBanner} role="dialog" aria-label="Shared setup">
      <div className={styles.sharedText}>
        <strong>Someone shared a setup with you</strong>
        <span>
          {shared.streams.length} stream{shared.streams.length === 1 ? '' : 's'} in {LAYOUT_NAMES[shared.layout]} layout
        </span>
        <div className={styles.sharedChips}>
          {shared.streams.map((s, i) => (
            <StreamChip key={i} stream={s} />
          ))}
        </div>
      </div>
      <div className={styles.sharedActions}>
        <button
          type="button"
          className={styles.primaryCta}
          onClick={() => {
            loadSetup(shared.streams, shared.layout);
            notify('success', 'Shared setup loaded.');
            close();
          }}
        >
          {filledCount ? 'Replace my streams' : 'Open setup'}
        </button>
        {filledCount > 0 && (
          <button
            type="button"
            className={styles.secondaryCta}
            onClick={() => {
              const added = addVideos(shared.streams).filter(r => r.ok).length;
              notify(added ? 'success' : 'error', added ? `Added ${added} stream${added === 1 ? '' : 's'}.` : 'No free slots for these streams.');
              close();
            }}
          >
            Add to mine
          </button>
        )}
        <button type="button" className={styles.ghostCta} onClick={close}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
