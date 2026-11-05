import { useState } from 'react';
import type { FormEvent } from 'react';
import { SLOT_COUNT } from '../../contexts/VideoContext';
import { useAddStreams } from '../../hooks/useAddStreams';
import { clearRecent, forgetRecent, useLibrary } from '../../services/library';
import type { StreamRef } from '../../services/library';
import { PLATFORM_META } from '../../services/urlParser';
import { ChatIcon, GridIcon, HistoryIcon, KeyboardIcon, LinkIcon, PlusIcon, ShareIcon, SparkleIcon, BookmarkIcon, VolumeOnIcon } from '../Icons';
import { SetupList, StreamChip } from './Library';
import type { Notify } from './Library';
import styles from './NowPlaying.module.css';

/* Two Lofi Girl 24/7 radios: always live, safe to autoplay muted. */
const DEMO_STREAMS: StreamRef[] = [
  { platform: 'youtube', videoId: 'jfKfPfyJRdk' },
  { platform: 'youtube', videoId: '4xDzrJKXOOY' },
];

const FEATURES = [
  { Icon: GridIcon, title: 'Four layouts', text: 'Stage, Spotlight, Theater, and Grid. Drag any divider to resize live.' },
  { Icon: VolumeOnIcon, title: 'One-tap audio', text: 'Exactly one stream plays sound. Switch with a click or keys 1-8.' },
  { Icon: ChatIcon, title: 'Live chat', text: 'Follow YouTube, Twitch, or Kick chat right beside the streams.' },
  { Icon: ShareIcon, title: 'Save & share', text: 'Save setups for later or send a link that opens the same view.' },
];

export function Welcome({ notify }: { notify: Notify }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const { addFromText, addStreams } = useAddStreams();
  const { recent, setups } = useLibrary();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = addFromText(text);
    if (result.added) {
      notify(result.tone, result.text);
      setText('');
      setError('');
    } else setError(result.text);
  };

  const quickAdd = (streams: StreamRef[]) => {
    const result = addStreams(streams);
    notify(result.tone, result.text);
  };

  return (
    <section className={styles.welcome}>
      <div className={`${styles.hero} frame`}>
        <div className={styles.heroBar}>
          <span className={styles.led} aria-hidden="true" />
          <span className="tag">Multi-stream console</span>
          <span className={`tag ${styles.heroSpec}`}>
            {SLOT_COUNT} CH / 4 layouts / YT · TTV · KICK
          </span>
        </div>
        <div className={styles.heroBody}>
        <h2 className={styles.heroTitle}>
          Every stream. <span className={styles.heroAccent}>One screen.</span>
        </h2>
        <p className={styles.heroText}>
          Watch up to {SLOT_COUNT} live channels, VODs, and videos side by side. Paste one link or a whole list, then arrange, listen, and
          chat without switching tabs.
        </p>

        <span className={`tag ${styles.sectionTag}`}>01 / Input</span>
        <form className={styles.heroForm} onSubmit={submit}>
          <label htmlFor="hero-links" className={styles.srOnly}>
            Stream links
          </label>
          <div className={styles.heroField}>
            <LinkIcon size={18} className={styles.heroFieldIcon} />
            <input
              id="hero-links"
              className={styles.heroInput}
              value={text}
              onChange={e => {
                setText(e.target.value);
                setError('');
              }}
              placeholder="Paste one or more stream links"
              autoComplete="off"
              spellCheck={false}
              inputMode="url"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'hero-error' : undefined}
            />
          </div>
          <button type="submit" className={styles.primaryCta}>
            <PlusIcon size={16} />
            Load streams
          </button>
        </form>
        {error && (
          <p id="hero-error" className={styles.heroError} role="alert">
            {error}
          </p>
        )}

        <div className={styles.heroMeta}>
          <button type="button" className={styles.secondaryCta} onClick={() => quickAdd(DEMO_STREAMS)}>
            <SparkleIcon size={14} />
            Run demo
          </button>
          <ul className={styles.platforms}>
            {(['youtube', 'twitch', 'kick', 'custom'] as const).map(p => (
              <li key={p} style={{ ['--platform' as string]: PLATFORM_META[p].color }}>
                <span className={styles.badgeDot} />
                {p === 'custom' ? 'Any embed' : PLATFORM_META[p].name}
              </li>
            ))}
          </ul>
        </div>
        </div>
      </div>

      {(recent.length > 0 || setups.length > 0) && (
        <div className={styles.libraryGrid}>
          {recent.length > 0 && (
            <div className={`${styles.libraryCard} frame`}>
              <div className={styles.libraryHeader}>
                <h3>
                  <HistoryIcon size={14} /> 02 / Recently watched
                </h3>
                <button type="button" className={styles.linkButton} onClick={clearRecent}>
                  Clear
                </button>
              </div>
              <div className={styles.chipWrap}>
                {recent.map(stream => (
                  <StreamChip
                    key={`${stream.platform}:${stream.videoId}`}
                    stream={stream}
                    onClick={() => quickAdd([stream])}
                    onRemove={() => forgetRecent(stream)}
                  />
                ))}
              </div>
              {recent.length > 1 && (
                <button type="button" className={styles.linkButton} onClick={() => quickAdd(recent.slice(0, SLOT_COUNT))}>
                  Open all ({Math.min(recent.length, SLOT_COUNT)})
                </button>
              )}
            </div>
          )}
          {setups.length > 0 && (
            <div className={`${styles.libraryCard} frame`}>
              <div className={styles.libraryHeader}>
                <h3>
                  <BookmarkIcon size={14} /> 03 / Saved setups
                </h3>
              </div>
              <SetupList setups={setups} notify={notify} />
            </div>
          )}
        </div>
      )}

      <ul className={styles.features}>
        {FEATURES.map(({ Icon, title, text: body }, i) => (
          <li key={title} className={`${styles.feature} frame`}>
            <div className={styles.featureTop}>
              <span className={styles.featureIcon}>
                <Icon size={18} />
              </span>
              <span className="tag">F-0{i + 1}</span>
            </div>
            <strong>{title}</strong>
            <span>{body}</span>
          </li>
        ))}
      </ul>

      <p className={styles.shortcutStrip}>
        <KeyboardIcon size={15} />
        <span>
          <kbd>/</kbd> paste link <kbd>1-8</kbd> audio <kbd>L</kbd> layout <kbd>C</kbd> chat <kbd>F</kbd> focus
        </span>
      </p>
    </section>
  );
}
