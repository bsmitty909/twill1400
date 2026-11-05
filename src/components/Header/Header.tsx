import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useVideo, SLOT_COUNT } from '../../contexts/VideoContext';
import { parseVideoUrl, PLATFORM_META } from '../../services/urlParser';
import { ArchiveIcon, LinkIcon, LockIcon, PlusIcon, TvIcon } from '../Icons';
import { navigate, useRoute } from '../../hooks/useRoute';
import styles from './Header.module.css';

type Feedback = { tone: 'error' | 'success'; text: string } | null;

export function Header() {
  const route = useRoute();
  const [url, setUrl] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const { addVideo, filledCount } = useVideo();
  const inputRef = useRef<HTMLInputElement>(null);
  const isFull = filledCount >= SLOT_COUNT;
  const detected = useMemo(() => (url.trim() ? parseVideoUrl(url) : null), [url]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 4000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    const focusOnSlash = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === '/' && !typing && inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', focusOnSlash);
    return () => window.removeEventListener('keydown', focusOnSlash);
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setFeedback({ tone: 'error', text: 'Paste a stream or video link first.' });
      return;
    }
    const parsed = parseVideoUrl(url);
    if (!parsed) {
      setFeedback({ tone: 'error', text: "That link doesn't look right. Try a YouTube, Twitch, or Kick URL." });
      return;
    }
    const result = addVideo(parsed.platform, parsed.videoId);
    if (!result.ok) {
      setFeedback({
        tone: 'error',
        text:
          result.reason === 'full'
            ? `All ${SLOT_COUNT} slots are in use. Remove a stream to add another.`
            : `Already playing in slot ${(result.slotId ?? 0) + 1}.`,
      });
      return;
    }
    setFeedback({ tone: 'success', text: `Added to slot ${result.slotId + 1}.` });
    setUrl('');
  };

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <a
          className={styles.brand}
          href="/"
          aria-label="TWill home"
          onClick={e => {
            e.preventDefault();
            navigate('watch');
          }}
        >
          <img src="/twill.jpg" alt="" className={styles.logo} width={36} height={36} />
          <span className={styles.wordmark}>
            <span className={styles.name}>TWill</span>
            <span className={styles.tagline}>The Content Plug</span>
          </span>
        </a>

        <nav className={styles.tabs} aria-label="Sections">
          <a
            href="/"
            className={`${styles.tab} ${route === 'watch' ? styles.tabActive : ''}`}
            aria-current={route === 'watch' ? 'page' : undefined}
            onClick={e => {
              e.preventDefault();
              navigate('watch');
            }}
          >
            <TvIcon size={15} />
            <span>Watch</span>
          </a>
          <a
            href="/archives"
            className={`${styles.tab} ${route === 'archives' ? styles.tabActive : ''}`}
            aria-current={route === 'archives' ? 'page' : undefined}
            onClick={e => {
              e.preventDefault();
              navigate('archives');
            }}
          >
            <ArchiveIcon size={15} />
            <span>Archives</span>
            <LockIcon size={11} className={styles.tabLock} />
          </a>
        </nav>

        {route === 'watch' && (
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <label htmlFor="stream-url" className={styles.srOnly}>
            Stream or video URL
          </label>
          <div className={styles.field}>
            <LinkIcon size={16} className={styles.fieldIcon} />
            <input
              id="stream-url"
              ref={inputRef}
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="Paste a YouTube, Twitch, or Kick link..."
              className={styles.input}
              aria-describedby="stream-url-feedback"
            />
            {detected ? (
              <span className={styles.detected} style={{ ['--platform' as string]: PLATFORM_META[detected.platform].color }}>
                {PLATFORM_META[detected.platform].name}
              </span>
            ) : (
              !url && <kbd className={styles.kbd}>/</kbd>
            )}
          </div>
          <button type="submit" className={styles.addButton} disabled={isFull}>
            <PlusIcon size={16} />
            <span>Add stream</span>
          </button>
          <div
            id="stream-url-feedback"
            className={`${styles.feedback} ${feedback ? styles[feedback.tone] : ''}`}
            role="status"
            aria-live="polite"
          >
            {feedback?.text}
          </div>
        </form>
        )}
      </div>
    </header>
  );
}
