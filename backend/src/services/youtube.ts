import * as fs from 'fs';
import { config } from '../config';
import { getRefreshToken } from './youtubeAccount';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const readJson = (response: Response): Promise<any> => response.json();

/*
 * Minimal YouTube Data API v3 client: OAuth refresh-token exchange,
 * resumable chunked uploads (survive network blips and server restarts via
 * the persisted session URL), and video deletion.
 *
 * Note: Google forces uploads from API projects that have not passed the
 * YouTube API compliance audit to "private". The privacy actually applied is
 * read back from the API response and stored so the UI can surface it.
 */

const CHUNK_SIZE = 32 * 1024 * 1024; // must be a multiple of 256 KiB
const MAX_RETRIES = 8;

let cachedToken: { value: string; expiresAt: number } | null = null;

export function resetTokenCache() {
  cachedToken = null;
}

export async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const { clientId, clientSecret } = config.google;
  const refreshToken = getRefreshToken();
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(`Google token refresh failed: ${data.error_description || data.error || response.status}`);
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

export interface UploadMetadata {
  title: string;
  description: string;
  tags?: string[];
  recordingDate?: string;
}

export interface UploadResult {
  videoId: string;
  privacyStatus: string;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function startSession(fileSize: number, metadata: UploadMetadata): Promise<string> {
  const url = new URL('https://www.googleapis.com/upload/youtube/v3/videos');
  url.searchParams.set('uploadType', 'resumable');
  url.searchParams.set('part', 'snippet,status,recordingDetails');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await getAccessToken()}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Length': String(fileSize),
      'X-Upload-Content-Type': 'video/mp4',
    },
    body: JSON.stringify({
      snippet: {
        title: metadata.title.slice(0, 100),
        description: metadata.description.slice(0, 5000),
        tags: metadata.tags,
        categoryId: '22',
      },
      status: {
        privacyStatus: config.youtubePrivacy,
        selfDeclaredMadeForKids: false,
        embeddable: true,
      },
      recordingDetails: metadata.recordingDate ? { recordingDate: metadata.recordingDate } : undefined,
    }),
  });

  if (!response.ok) {
    throw new Error(`YouTube upload init failed (${response.status}): ${await describeError(response)}`);
  }
  const location = response.headers.get('location');
  if (!location) throw new Error('YouTube did not return an upload session URL.');
  return location;
}

async function describeError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const data = JSON.parse(text);
    return data.error?.message || data.error?.errors?.[0]?.reason || text.slice(0, 300);
  } catch {
    return text.slice(0, 300);
  }
}

/** Returns the next byte offset to send, or the finished video. */
async function querySession(sessionUrl: string, fileSize: number): Promise<number | UploadResult | null> {
  const response = await fetch(sessionUrl, {
    method: 'PUT',
    redirect: 'manual',
    headers: {
      Authorization: `Bearer ${await getAccessToken()}`,
      'Content-Length': '0',
      'Content-Range': `bytes */${fileSize}`,
    },
  });
  if (response.status === 200 || response.status === 201) return toResult(await readJson(response));
  if (response.status === 308) return nextOffset(response);
  if (response.status === 404 || response.status === 410) return null;
  throw new Error(`YouTube upload status check failed (${response.status}): ${await describeError(response)}`);
}

function nextOffset(response: Response): number {
  const range = response.headers.get('range');
  const match = range?.match(/bytes=0-(\d+)/);
  return match ? Number(match[1]) + 1 : 0;
}

function toResult(video: { id: string; status?: { privacyStatus?: string } }): UploadResult {
  return { videoId: video.id, privacyStatus: video.status?.privacyStatus ?? 'unknown' };
}

function readChunk(fd: number, offset: number, length: number): Buffer {
  const buffer = Buffer.alloc(length);
  const bytesRead = fs.readSync(fd, buffer, 0, length, offset);
  return buffer.subarray(0, bytesRead);
}

export async function uploadVideo(
  filePath: string,
  metadata: UploadMetadata,
  options: {
    sessionUrl?: string | null;
    onSession?: (url: string) => void;
    onProgress?: (fraction: number) => void;
  } = {}
): Promise<UploadResult> {
  const fileSize = fs.statSync(filePath).size;
  let sessionUrl = options.sessionUrl ?? null;
  let offset = 0;

  if (sessionUrl) {
    const state = await querySession(sessionUrl, fileSize).catch(() => null);
    if (state && typeof state === 'object') return state;
    if (typeof state === 'number') offset = state;
    else sessionUrl = null;
  }
  if (!sessionUrl) {
    sessionUrl = await startSession(fileSize, metadata);
    options.onSession?.(sessionUrl);
  }

  const fd = fs.openSync(filePath, 'r');
  try {
    let retries = 0;
    while (true) {
      const chunk = readChunk(fd, offset, Math.min(CHUNK_SIZE, fileSize - offset));
      const end = offset + chunk.length - 1;
      try {
        const response = await fetch(sessionUrl, {
          method: 'PUT',
          redirect: 'manual',
          headers: {
            Authorization: `Bearer ${await getAccessToken()}`,
            'Content-Length': String(chunk.length),
            'Content-Range': `bytes ${offset}-${end}/${fileSize}`,
            'Content-Type': 'video/mp4',
          },
          body: chunk,
        });

        if (response.status === 200 || response.status === 201) {
          options.onProgress?.(1);
          return toResult(await readJson(response));
        }
        if (response.status === 308) {
          offset = nextOffset(response);
          retries = 0;
          options.onProgress?.(offset / fileSize);
          continue;
        }
        if (response.status === 401) cachedToken = null;
        if (response.status === 404 || response.status === 410) {
          throw Object.assign(new Error('Upload session expired.'), { fatal: true });
        }
        if (response.status < 500 && response.status !== 401 && response.status !== 429) {
          throw Object.assign(new Error(`YouTube rejected the upload (${response.status}): ${await describeError(response)}`), { fatal: true });
        }
        throw new Error(`YouTube upload error ${response.status}`);
      } catch (error) {
        if ((error as { fatal?: boolean }).fatal || ++retries > MAX_RETRIES) throw error;
        await sleep(Math.min(2 ** retries * 1000, 60_000));
        const state = await querySession(sessionUrl, fileSize).catch(() => offset);
        if (state === null) throw new Error('Upload session expired.');
        if (typeof state === 'object') return state;
        offset = state;
      }
    }
  } finally {
    fs.closeSync(fd);
  }
}

export async function deleteVideo(videoId: string): Promise<void> {
  const url = new URL('https://www.googleapis.com/youtube/v3/videos');
  url.searchParams.set('id', videoId);
  const response = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${await getAccessToken()}` } });
  if (!response.ok && response.status !== 404) {
    throw new Error(`YouTube delete failed (${response.status}): ${await describeError(response)}`);
  }
}

export async function getAuthorizedChannel(): Promise<{ id: string; title: string } | null> {
  const url = new URL('https://www.googleapis.com/youtube/v3/channels');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('mine', 'true');
  const response = await fetch(url, { headers: { Authorization: `Bearer ${await getAccessToken()}` } });
  if (!response.ok) throw new Error(`YouTube channel lookup failed (${response.status}): ${await describeError(response)}`);
  const data = await readJson(response);
  const channel = data.items?.[0];
  return channel ? { id: channel.id, title: channel.snippet.title } : null;
}
