import { execFile, spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import { config } from '../config';

/*
 * All yt-dlp invocations use execFile/spawn with argument arrays - never a
 * shell - so user-supplied channel inputs cannot inject commands. Node is
 * passed as the JS runtime yt-dlp needs for YouTube's player challenges.
 */
const BASE_ARGS = ['--js-runtimes', 'node', '--no-warnings', '--ignore-config'];

function run(args: string[], timeoutMs = 90_000): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise(resolve => {
    execFile(config.ytDlpPath, [...BASE_ARGS, ...args], { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 }, (error, stdout, stderr) => {
      const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0;
      resolve({ stdout, stderr, code });
    });
  });
}

function lastErrorLine(stderr: string): string {
  const lines = stderr.trim().split('\n').filter(Boolean);
  const error = [...lines].reverse().find(l => l.startsWith('ERROR'));
  return (error ?? lines.at(-1) ?? 'yt-dlp failed').replace(/^ERROR:\s*/, '').slice(0, 300);
}

/** Accepts @handle, a bare handle, a channel id, or any youtube.com channel URL. */
export function normalizeChannelInput(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (/^UC[\w-]{22}$/.test(value)) return `https://www.youtube.com/channel/${value}`;
  if (/^@?[\w.-]{3,100}$/.test(value)) return `https://www.youtube.com/@${value.replace(/^@/, '')}`;

  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`);
    const host = url.hostname.replace(/^(www|m)\./, '');
    if (host !== 'youtube.com') return null;
    const [first, second] = url.pathname.split('/').filter(Boolean);
    if (!first) return null;
    if (first.startsWith('@')) return `https://www.youtube.com/${first}`;
    if (['channel', 'c', 'user'].includes(first) && second) return `https://www.youtube.com/${first}/${second}`;
    return null;
  } catch {
    return null;
  }
}

export interface ResolvedChannel {
  youtubeChannelId: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
}

export async function resolveChannel(input: string): Promise<ResolvedChannel> {
  const url = normalizeChannelInput(input);
  if (!url) throw new Error('Enter a YouTube channel handle (@name), channel ID, or channel URL.');

  const { stdout, stderr, code } = await run(['-J', '--flat-playlist', '--playlist-items', '0', url], 60_000);
  if (code !== 0 || !stdout.trim()) {
    throw new Error(/not found|404/i.test(stderr) ? 'That YouTube channel could not be found.' : lastErrorLine(stderr));
  }

  const data = JSON.parse(stdout);
  if (!data.channel_id) throw new Error('That URL is not a YouTube channel.');
  const thumbnails: { id?: string; url?: string }[] = data.thumbnails ?? [];
  return {
    youtubeChannelId: data.channel_id,
    name: data.channel || data.title || data.channel_id,
    handle: typeof data.uploader_id === 'string' && data.uploader_id.startsWith('@') ? data.uploader_id : null,
    avatarUrl: thumbnails.find(t => t.id === 'avatar_uncropped')?.url ?? null,
  };
}

export type LiveCheck = { live: true; videoId: string; title: string } | { live: false } | { live: false; error: string };

export async function checkLive(youtubeChannelId: string): Promise<LiveCheck> {
  const url = `https://www.youtube.com/channel/${youtubeChannelId}/live`;
  const { stdout, stderr, code } = await run(['--skip-download', '--print', '%(id)s\t%(live_status)s\t%(title)s', url], 60_000);

  if (code !== 0) {
    if (/not currently live|has not started|will begin|premieres in/i.test(stderr)) return { live: false };
    return { live: false, error: lastErrorLine(stderr) };
  }

  const [videoId, status, ...titleParts] = stdout.trim().split('\n')[0].split('\t');
  if (status === 'is_live' && videoId) return { live: true, videoId, title: titleParts.join('\t') };
  return { live: false };
}

/**
 * Records a live stream until it ends or the process receives SIGINT. Output
 * is MPEG-TS so an interrupted recording is still playable.
 */
export function recordLive(videoId: string, outputPath: string): ChildProcess {
  return spawn(
    config.ytDlpPath,
    [
      ...BASE_ARGS,
      '-f', config.recordFormat,
      '--hls-use-mpegts',
      '--no-part',
      '--no-progress',
      '--retries', '10',
      '--fragment-retries', '50',
      '-o', outputPath,
      `https://www.youtube.com/watch?v=${videoId}`,
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] }
  );
}

export { lastErrorLine };
