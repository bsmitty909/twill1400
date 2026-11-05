import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { archiveApi, ApiError, mediaUrl, thumbnailUrl } from '../../services/archiveApi';
import type { ArchiveChannel, ArchiveRecording, ArchiveStatus, StorageInfo, YouTubeConnection } from '../../services/archiveApi';
import { useVideo } from '../../contexts/VideoContext';
import { navigate } from '../../hooks/useRoute';
import { formatBytes, formatDate, formatDuration, timeAgo } from './format';
import {
  AlertIcon,
  ArchiveIcon,
  CloseIcon,
  DownloadIcon,
  ExternalIcon,
  LockIcon,
  LogoutIcon,
  PlayIcon,
  PlusIcon,
  RefreshIcon,
  StopIcon,
  TrashIcon,
  TvIcon,
} from '../Icons';
import styles from './Archives.module.css';

const POLL_MS = 10_000;

type Notice = { tone: 'error' | 'success'; text: string } | null;

/* ------------------------------------------------------------------ login */

function LoginCard({ onSuccess, configured }: { onSuccess: () => void; configured: boolean }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError('');
    try {
      await archiveApi.login(password);
      setPassword('');
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.loginWrap}>
      <form className={`${styles.loginCard} frame`} onSubmit={submit}>
        <span className={styles.lockBadge}>
          <LockIcon size={22} />
        </span>
        <h1 className={styles.loginTitle}>Archives</h1>
        <p className={styles.muted}>This area is private. Enter the archive password to continue.</p>
        {!configured && (
          <p className={styles.inlineError}>
            <AlertIcon size={15} /> The archive password has not been set up on the server yet.
          </p>
        )}
        <label htmlFor="archive-password" className={styles.label}>
          Password
        </label>
        <input
          id="archive-password"
          type="password"
          className={styles.input}
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="current-password"
          autoFocus
        />
        {error && (
          <p className={styles.inlineError} role="alert">
            <AlertIcon size={15} /> {error}
          </p>
        )}
        <button type="submit" className={styles.primaryButton} disabled={busy || !password}>
          {busy ? 'Checking...' : 'Unlock archives'}
        </button>
      </form>
    </section>
  );
}

/* ---------------------------------------------------------------- helpers */

function ConfirmButton({
  label,
  confirmLabel = 'Confirm?',
  onConfirm,
  className,
  icon,
  disabled,
}: {
  label: string;
  confirmLabel?: string;
  onConfirm: () => void;
  className: string;
  icon: React.ReactNode;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 3000);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      className={`${className} ${armed ? styles.danger : ''}`}
      disabled={disabled}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
      title={label}
      aria-label={armed ? confirmLabel : label}
    >
      {icon}
      <span>{armed ? confirmLabel : label}</span>
    </button>
  );
}

const STATUS_LABEL: Record<ArchiveRecording['status'], string> = {
  recording: 'Recording',
  processing: 'Processing',
  queued: 'Queued',
  uploading: 'Uploading',
  uploaded: 'Archived',
  failed: 'Failed',
};

/* --------------------------------------------------------------- channels */

function ChannelRow({
  channel,
  now,
  act,
}: {
  channel: ArchiveChannel;
  now: number;
  act: (fn: () => Promise<unknown>, success?: string) => Promise<void>;
}) {
  const state = !channel.enabled
    ? { cls: styles.pillMuted, text: 'Paused' }
    : channel.recording
      ? { cls: styles.pillLive, text: 'Recording live' }
      : channel.status === 'error'
        ? { cls: styles.pillError, text: 'Check failed' }
        : { cls: styles.pillMuted, text: 'Offline' };

  return (
    <li className={styles.channel}>
      {channel.avatarUrl ? (
        <img className={styles.avatar} src={channel.avatarUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        <span className={styles.avatar} aria-hidden="true">
          {channel.name.slice(0, 1)}
        </span>
      )}
      <div className={styles.channelBody}>
        <div className={styles.channelTop}>
          <a
            className={styles.channelName}
            href={`https://www.youtube.com/channel/${channel.youtubeChannelId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {channel.name}
          </a>
          <span className={`${styles.pill} ${state.cls}`}>
            {channel.recording && <span className={styles.recDot} />}
            {state.text}
          </span>
        </div>
        <div className={styles.meta}>
          {channel.handle && <span>{channel.handle}</span>}
          <span>Checked {timeAgo(channel.lastCheckedAt, now)}</span>
          {channel.lastLiveAt && <span>Last live {timeAgo(channel.lastLiveAt, now)}</span>}
        </div>
        {channel.lastError && channel.status === 'error' && <p className={styles.rowError}>{channel.lastError}</p>}
      </div>
      <div className={styles.rowActions}>
        <label className={styles.switch} title={channel.enabled ? 'Auto-record on' : 'Auto-record off'}>
          <input
            type="checkbox"
            checked={channel.enabled}
            onChange={e => act(() => archiveApi.setChannelEnabled(channel.id, e.target.checked))}
            aria-label={`Auto-record ${channel.name}`}
          />
          <span />
        </label>
        <button
          type="button"
          className={styles.ghostButton}
          onClick={() => act(() => archiveApi.checkChannel(channel.id))}
          title="Check now"
          aria-label={`Check ${channel.name} now`}
        >
          <RefreshIcon size={15} />
        </button>
        <ConfirmButton
          className={styles.ghostButton}
          label="Remove"
          confirmLabel="Remove?"
          icon={<TrashIcon size={15} />}
          onConfirm={() => act(() => archiveApi.removeChannel(channel.id), `Removed ${channel.name}.`)}
        />
      </div>
    </li>
  );
}

function ChannelsPanel({
  channels,
  now,
  act,
  pollIntervalSec,
}: {
  channels: ArchiveChannel[];
  now: number;
  act: (fn: () => Promise<unknown>, success?: string) => Promise<void>;
  pollIntervalSec: number;
}) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setBusy(true);
    await act(async () => {
      const { channel } = await archiveApi.addChannel(input.trim());
      setInput('');
      return channel;
    }, 'Channel added. It will be recorded automatically whenever it goes live.');
    setBusy(false);
  };

  return (
    <section className={`${styles.panel} frame`}>
      <header className={styles.panelHeader}>
        <div>
          <h2 className={styles.panelTitle}>Channels</h2>
          <p className={styles.muted}>Checked every {Math.round(pollIntervalSec / 60)} min. Lives are recorded automatically.</p>
        </div>
      </header>
      <form className={styles.addForm} onSubmit={add}>
        <input
          className={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="@handle or youtube.com/channel URL"
          aria-label="YouTube channel"
          disabled={busy}
        />
        <button type="submit" className={styles.primaryButton} disabled={busy || !input.trim()}>
          <PlusIcon size={16} />
          <span>{busy ? 'Looking up...' : 'Add channel'}</span>
        </button>
      </form>
      {channels.length === 0 ? (
        <p className={styles.empty}>No channels yet. Add a YouTube channel to start archiving its lives.</p>
      ) : (
        <ul className={styles.channelList}>
          {channels.map(c => (
            <ChannelRow key={c.id} channel={c} now={now} act={act} />
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------- recordings */

function RecordingCard({
  recording,
  now,
  act,
  onPlay,
}: {
  recording: ArchiveRecording;
  now: number;
  act: (fn: () => Promise<unknown>, success?: string) => Promise<void>;
  onPlay: (r: ArchiveRecording) => void;
}) {
  const { addVideo } = useVideo();
  const inStorage = recording.status === 'uploaded' && recording.hasMedia;
  const onYouTube = recording.status === 'uploaded' && Boolean(recording.youtubeVideoId);
  const playable = inStorage || onYouTube;
  const thumb = recording.hasThumbnail
    ? thumbnailUrl(recording.id)
    : onYouTube
      ? `https://i.ytimg.com/vi/${recording.youtubeVideoId}/mqdefault.jpg`
      : null;
  const daysLeft = recording.expiresAt ? Math.ceil((new Date(recording.expiresAt).getTime() - now) / 86400000) : null;
  const elapsed =
    recording.status === 'recording' ? Math.round((now - new Date(recording.startedAt).getTime()) / 1000) : recording.durationSec;
  const forcedPrivate = recording.status === 'uploaded' && recording.youtubePrivacy === 'private';

  const addToViewer = () => {
    const result = inStorage
      ? addVideo('custom', new URL(mediaUrl(recording.id), window.location.origin).toString())
      : recording.youtubeVideoId
        ? addVideo('youtube', recording.youtubeVideoId)
        : null;
    if (!result) return;
    if (result.ok || result.reason === 'duplicate') navigate('watch');
    else void act(() => Promise.reject(new Error('All viewer slots are full. Remove a stream first.')));
  };

  return (
    <li className={styles.recording}>
      <button
        type="button"
        className={styles.thumb}
        onClick={() => playable && onPlay(recording)}
        disabled={!playable}
        aria-label={playable ? `Play ${recording.sourceTitle}` : undefined}
      >
        {playable ? (
          <>
            {thumb ? <img src={thumb} alt="" loading="lazy" /> : <span className={styles.thumbState}>Ready</span>}
            <span className={styles.playOverlay}>
              <PlayIcon size={22} />
            </span>
          </>
        ) : (
          <span className={styles.thumbState}>
            {recording.status === 'recording' && <span className={styles.recDot} />}
            {STATUS_LABEL[recording.status]}
          </span>
        )}
        <span className={styles.duration}>{formatDuration(elapsed)}</span>
      </button>

      <div className={styles.recBody}>
        <div className={styles.recTop}>
          <span className={`${styles.pill} ${styles[`st_${recording.status}`]}`}>
            {recording.status === 'recording' && <span className={styles.recDot} />}
            {STATUS_LABEL[recording.status]}
            {recording.status === 'uploading' && recording.uploadProgress !== null && ` ${Math.round(recording.uploadProgress * 100)}%`}
          </span>
          <span className={styles.recChannel}>{recording.channelName}</span>
        </div>
        <h3 className={styles.recTitle} title={recording.sourceTitle}>
          {recording.sourceTitle}
        </h3>
        <div className={styles.meta}>
          <span>{formatDate(recording.startedAt)}</span>
          {recording.sizeBytes ? <span>{formatBytes(recording.sizeBytes)}</span> : null}
          {daysLeft !== null && recording.status === 'uploaded' && (
            <span className={daysLeft <= 3 ? styles.expiring : undefined}>
              {daysLeft <= 0 ? 'Deleting soon' : `Deletes in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}
            </span>
          )}
        </div>
        {recording.status === 'uploading' && (
          <div className={styles.progress} aria-hidden="true">
            <span style={{ width: `${Math.round((recording.uploadProgress ?? 0) * 100)}%` }} />
          </div>
        )}
        {forcedPrivate && (
          <p className={styles.rowWarn}>
            YouTube set this upload to private (API project not yet audited). Only the archive channel owner can watch it.
          </p>
        )}
        {recording.error && recording.status !== 'uploaded' && <p className={styles.rowError}>{recording.error}</p>}

        <div className={styles.recActions}>
          {playable && (
            <>
              <button type="button" className={styles.smallButton} onClick={() => onPlay(recording)}>
                <PlayIcon size={13} />
                <span>Play</span>
              </button>
              {inStorage && (
                <a className={styles.smallButton} href={mediaUrl(recording.id, true)} download>
                  <DownloadIcon size={13} />
                  <span>Download</span>
                </a>
              )}
              <button type="button" className={styles.smallButton} onClick={addToViewer}>
                <TvIcon size={14} />
                <span>Add to viewer</span>
              </button>
              {onYouTube && (
                <a
                  className={styles.smallButton}
                  href={`https://www.youtube.com/watch?v=${recording.youtubeVideoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalIcon size={13} />
                  <span>YouTube</span>
                </a>
              )}
            </>
          )}
          {recording.status === 'recording' && (
            <ConfirmButton
              className={styles.smallButton}
              label="Stop recording"
              confirmLabel="Stop now?"
              icon={<StopIcon size={13} />}
              onConfirm={() => act(() => archiveApi.stopRecording(recording.id), 'Recording stopped. It will be uploaded shortly.')}
            />
          )}
          {recording.status === 'failed' && recording.hasLocalFile && (
            <button type="button" className={styles.smallButton} onClick={() => act(() => archiveApi.retryRecording(recording.id), 'Retrying upload.')}>
              <RefreshIcon size={13} />
              <span>Retry</span>
            </button>
          )}
          {!['recording', 'processing', 'uploading'].includes(recording.status) && (
            <ConfirmButton
              className={styles.smallButton}
              label="Delete"
              confirmLabel={recording.youtubeVideoId ? 'Delete from YouTube too?' : recording.hasMedia ? 'Delete permanently?' : 'Delete?'}
              icon={<TrashIcon size={13} />}
              onConfirm={() => act(() => archiveApi.deleteRecording(recording.id), 'Recording deleted.')}
            />
          )}
        </div>
      </div>
    </li>
  );
}

function RecordingsPanel({
  recordings,
  channels,
  now,
  act,
}: {
  recordings: ArchiveRecording[];
  channels: ArchiveChannel[];
  now: number;
  act: (fn: () => Promise<unknown>, success?: string) => Promise<void>;
}) {
  const [channelFilter, setChannelFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [playing, setPlaying] = useState<ArchiveRecording | null>(null);

  const channelOptions = useMemo(() => {
    const names = new Map<string, string>();
    for (const r of recordings) names.set(r.channelId, r.channelName);
    for (const c of channels) names.set(c.id, c.name);
    return [...names.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [recordings, channels]);

  const visible = recordings.filter(r => {
    if (channelFilter !== 'all' && r.channelId !== channelFilter) return false;
    const q = query.trim().toLowerCase();
    return !q || r.sourceTitle.toLowerCase().includes(q) || r.channelName.toLowerCase().includes(q);
  });

  return (
    <section className={`${styles.panel} frame`}>
      <header className={styles.panelHeader}>
        <div>
          <h2 className={styles.panelTitle}>Recordings</h2>
          <p className={styles.muted}>
            {recordings.length} total · {recordings.filter(r => r.status === 'uploaded').length} archived
          </p>
        </div>
        <div className={styles.filters}>
          <select className={styles.select} value={channelFilter} onChange={e => setChannelFilter(e.target.value)} aria-label="Filter by channel">
            <option value="all">All channels</option>
            {channelOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <input
            className={`${styles.input} ${styles.search}`}
            type="search"
            placeholder="Search titles"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search recordings"
          />
        </div>
      </header>

      {visible.length === 0 ? (
        <p className={styles.empty}>
          {recordings.length === 0 ? 'Nothing recorded yet. Recordings appear here as soon as a channel goes live.' : 'No recordings match.'}
        </p>
      ) : (
        <ul className={styles.recordingList}>
          {visible.map(r => (
            <RecordingCard key={r.id} recording={r} now={now} act={act} onPlay={setPlaying} />
          ))}
        </ul>
      )}

      {playing && (playing.hasMedia || playing.youtubeVideoId) && <PlayerModal recording={playing} onClose={() => setPlaying(null)} />}
    </section>
  );
}

function PlayerModal({ recording, onClose }: { recording: ArchiveRecording; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const youtubeSrc = () => {
    const src = new URL(`https://www.youtube-nocookie.com/embed/${encodeURIComponent(recording.youtubeVideoId!)}`);
    src.searchParams.set('autoplay', '1');
    src.searchParams.set('rel', '0');
    return src.toString();
  };

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={recording.sourceTitle}
        tabIndex={-1}
        ref={dialogRef}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <div className={styles.modalTitles}>
            <span className={styles.recChannel}>{recording.channelName}</span>
            <h3 className={styles.recTitle}>{recording.sourceTitle}</h3>
          </div>
          {recording.hasMedia && (
            <a className={styles.ghostButton} href={mediaUrl(recording.id, true)} download aria-label="Download recording">
              <DownloadIcon size={15} />
              <span>Download</span>
            </a>
          )}
          <button type="button" className={styles.ghostButton} onClick={onClose} aria-label="Close player">
            <CloseIcon size={16} />
          </button>
        </div>
        <div className={styles.modalPlayer}>
          {recording.hasMedia ? (
            <video src={mediaUrl(recording.id)} controls autoPlay playsInline preload="metadata" poster={recording.hasThumbnail ? thumbnailUrl(recording.id) : undefined} />
          ) : (
            <iframe src={youtubeSrc()} title={recording.sourceTitle} allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- storage */

function StorageCard() {
  const [info, setInfo] = useState<StorageInfo | null>(null);
  useEffect(() => {
    archiveApi.storage().then(setInfo, () => undefined);
  }, []);
  if (!info) return null;

  const ok = info.configured && !info.error;
  return (
    <section className={`${styles.panel} ${styles.youtubeCard} frame`}>
      <div className={styles.youtubeBody}>
        <span className={`${styles.storageLogo} ${ok ? '' : styles.storageLogoWarn}`} aria-hidden="true">
          <ArchiveIcon size={16} />
        </span>
        <div className={styles.channelBody}>
          <h2 className={styles.panelTitle}>Storage</h2>
          {!info.configured ? (
            <p className={styles.muted}>Storage is not set up on the server yet. Recordings wait on the server until it is.</p>
          ) : info.error ? (
            <p className={styles.rowError}>Storage is unreachable right now. Recordings wait on the server and can be retried.</p>
          ) : (
            <p className={styles.muted}>
              Private storage
              {info.retentionDays ? ` · recordings are kept for ${info.retentionDays} days` : ' · recordings are kept until deleted'}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- youtube */

function YouTubeCard({ act }: { act: (fn: () => Promise<unknown>, success?: string) => Promise<void> }) {
  const [info, setInfo] = useState<YouTubeConnection | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    archiveApi.youtube().then(setInfo, () => undefined);
  }, []);
  useEffect(load, [load]);

  const connect = async () => {
    setBusy(true);
    await act(async () => {
      const { url } = await archiveApi.connectYouTube();
      window.location.assign(url);
    });
    setBusy(false);
  };

  if (!info) return null;

  return (
    <section className={`${styles.panel} ${styles.youtubeCard} frame`}>
      <div className={styles.youtubeBody}>
        <span className={styles.youtubeLogo} aria-hidden="true">
          <PlayIcon size={14} />
        </span>
        <div className={styles.channelBody}>
          <h2 className={styles.panelTitle}>Archive channel</h2>
          {info.channel ? (
            <p className={styles.muted}>
              Uploading {info.privacy} to <strong className={styles.strong}>{info.channel.title}</strong>
            </p>
          ) : info.clientConfigured ? (
            <p className={styles.muted}>Not connected. Recordings wait on the server until a YouTube channel is connected.</p>
          ) : (
            <p className={styles.muted}>
              Google OAuth is not configured on the server yet (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET). Authorized redirect URI:{' '}
              <code className={styles.code}>{info.redirectUri}</code>
            </p>
          )}
        </div>
      </div>
      <div className={styles.rowActions}>
        {info.channel ? (
          <ConfirmButton
            className={styles.ghostButton}
            label="Disconnect"
            confirmLabel="Disconnect?"
            icon={<CloseIcon size={14} />}
            onConfirm={() =>
              act(async () => {
                await archiveApi.disconnectYouTube();
                load();
              }, 'YouTube disconnected.')
            }
          />
        ) : (
          <button type="button" className={styles.primaryButton} onClick={connect} disabled={busy || !info.clientConfigured}>
            {busy ? 'Opening Google...' : 'Connect YouTube'}
          </button>
        )}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- page */

/** Keeps the archive out of search results and stops media URLs leaking via Referer. */
function usePrivatePageMeta() {
  useEffect(() => {
    const tags = [
      Object.assign(document.createElement('meta'), { name: 'robots', content: 'noindex, nofollow, noarchive, nosnippet' }),
      Object.assign(document.createElement('meta'), { name: 'referrer', content: 'no-referrer' }),
    ];
    tags.forEach(tag => document.head.appendChild(tag));
    const previousTitle = document.title;
    document.title = 'Archives - TWill';
    return () => {
      tags.forEach(tag => tag.remove());
      document.title = previousTitle;
    };
  }, []);
}

export function ArchivesPage() {
  usePrivatePageMeta();
  const [session, setSession] = useState<'loading' | 'locked' | 'open'>('loading');
  const [configured, setConfigured] = useState(true);
  const [data, setData] = useState<ArchiveStatus | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [loadError, setLoadError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const handleError = useCallback((err: unknown) => {
    if (err instanceof ApiError && err.status === 401) {
      setSession('locked');
      setData(null);
      return;
    }
    setNotice({ tone: 'error', text: (err as Error).message });
  }, []);

  const refresh = useCallback(async () => {
    try {
      setData(await archiveApi.status());
      setLoadError('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) handleError(err);
      else setLoadError((err as Error).message);
    }
  }, [handleError]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('youtube') === 'connected';
    const failure = params.get('youtube_error');
    if (!connected && !failure) return;
    window.history.replaceState(null, '', '/archives');
    const t = window.setTimeout(
      () => setNotice(connected ? { tone: 'success', text: 'YouTube connected. Waiting recordings are uploading now.' } : { tone: 'error', text: failure! }),
      0
    );
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    archiveApi
      .session()
      .then(s => {
        setConfigured(s.configured);
        setSession(s.authenticated ? 'open' : 'locked');
      })
      .catch(err => {
        setLoadError((err as Error).message);
        setSession('locked');
      });
  }, []);

  useEffect(() => {
    if (session !== 'open') return;
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
      setNow(Date.now());
    }, POLL_MS);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [session, refresh]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const act = useCallback(
    async (fn: () => Promise<unknown>, success?: string) => {
      try {
        await fn();
        if (success) setNotice({ tone: 'success', text: success });
        await refresh();
      } catch (err) {
        handleError(err);
      }
    },
    [refresh, handleError]
  );

  const logout = async () => {
    await archiveApi.logout().catch(() => undefined);
    setSession('locked');
    setData(null);
  };

  if (session === 'loading') return <div className={styles.loading}>Loading...</div>;
  if (session === 'locked') {
    return (
      <>
        {loadError && <p className={`${styles.banner} ${styles.bannerError}`}>{loadError}</p>}
        <LoginCard configured={configured} onSuccess={() => setSession('open')} />
      </>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>Private</span>
          <h1 className={styles.pageTitle}>Archives</h1>
        </div>
        <div className={styles.headerStats}>
          {data && (
            <>
              <span className={styles.stat}>
                <strong>{data.recorder.activeRecordings}</strong> recording
              </span>
              <span className={styles.stat}>
                <strong>{data.recorder.uploadQueue + (data.recorder.uploading ? 1 : 0)}</strong> uploading
              </span>
            </>
          )}
          <button type="button" className={styles.ghostButton} onClick={logout} title="Log out of Archives on this browser">
            <LogoutIcon size={15} />
            <span>Log out</span>
          </button>
        </div>
      </div>

      {data && (data.recorder.target === 's3' ? <StorageCard /> : <YouTubeCard act={act} />)}
      {loadError && (
        <p className={`${styles.banner} ${styles.bannerError}`}>
          <AlertIcon size={16} /> {loadError}
        </p>
      )}

      {!data ? (
        <div className={styles.loading}>Loading archives...</div>
      ) : (
        <div className={styles.columns}>
          <ChannelsPanel channels={data.channels} now={now} act={act} pollIntervalSec={data.recorder.pollIntervalSec} />
          <RecordingsPanel recordings={data.recordings} channels={data.channels} now={now} act={act} />
        </div>
      )}

      {notice && (
        <div className={`${styles.toast} ${notice.tone === 'error' ? styles.toastError : styles.toastSuccess}`} role="status">
          {notice.text}
        </div>
      )}
    </main>
  );
}
