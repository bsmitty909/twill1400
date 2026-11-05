import { useState } from 'react';
import type { Platform } from '../../types/index.ts';
import { getSourceUrl } from '../../services/urlParser';
import { DownloadIcon } from '../Icons';

/*
 * Cloud download relies on the yt-dlp backend in backend/. It is only shown
 * when the build is pointed at a running backend via VITE_API_URL; without
 * it the button would just fail for every visitor.
 */
const API_URL: string | undefined = import.meta.env.VITE_API_URL;

interface DownloadButtonProps {
  platform: Platform;
  videoId: string;
  className: string;
}

export function DownloadButton({ platform, videoId, className }: DownloadButtonProps) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');

  if (!API_URL || platform === 'custom') return null;

  const handleDownload = async () => {
    setState('busy');
    try {
      const response = await fetch(new URL('/api/download', API_URL), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: getSourceUrl(platform, videoId) }),
      });
      const data = await response.json().catch(() => ({}));
      setState(response.ok && data.success ? 'done' : 'error');
    } catch {
      setState('error');
    }
    window.setTimeout(() => setState('idle'), 3000);
  };

  const label = { idle: 'Save to cloud', busy: 'Saving...', done: 'Saved to cloud', error: 'Save failed' }[state];

  return (
    <button type="button" className={className} onClick={handleDownload} disabled={state === 'busy'} title={label} aria-label={label} data-state={state}>
      <DownloadIcon size={15} />
    </button>
  );
}
