export type ChannelStatus = 'idle' | 'live' | 'error';
export type RecordingStatus = 'recording' | 'processing' | 'queued' | 'uploading' | 'uploaded' | 'failed';

export interface ArchiveChannel {
  id: string;
  youtubeChannelId: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  enabled: boolean;
  status: ChannelStatus;
  recording: boolean;
  lastCheckedAt: string | null;
  lastLiveAt: string | null;
  lastError: string | null;
  addedAt: string;
}

export interface ArchiveRecording {
  id: string;
  channelId: string;
  channelName: string;
  sourceVideoId: string;
  sourceTitle: string;
  status: RecordingStatus;
  startedAt: string;
  endedAt: string | null;
  durationSec: number | null;
  sizeBytes: number | null;
  uploadProgress: number | null;
  youtubeVideoId: string | null;
  youtubePrivacy: string | null;
  error: string | null;
  hasLocalFile: boolean;
  storage: 's3' | 'youtube' | null;
  hasMedia: boolean;
  hasThumbnail: boolean;
  expiresAt: string | null;
  tags: string[];
}

export interface ArchiveStatus {
  channels: ArchiveChannel[];
  recordings: ArchiveRecording[];
  recorder: {
    activeRecordings: number;
    uploadQueue: number;
    uploading: boolean;
    youtubeConfigured: boolean;
    target: 's3' | 'youtube';
    targetReady: boolean;
    retentionDays: number;
    pollIntervalSec: number;
  };
}

export interface SessionInfo {
  authenticated: boolean;
  configured: boolean;
  youtubeConfigured: boolean;
}

export interface YouTubeConnection {
  clientConfigured: boolean;
  channel: { id: string; title: string } | null;
  privacy: string;
  redirectUri: string;
}

export interface StorageInfo {
  target: 's3' | 'youtube';
  configured: boolean;
  retentionDays: number;
  error: string | null;
}

export const mediaUrl = (id: string, download = false) =>
  `/api/archives/recordings/${encodeURIComponent(id)}/media${download ? '?download=1' : ''}`;
export const thumbnailUrl = (id: string) => `/api/archives/recordings/${encodeURIComponent(id)}/thumbnail`;

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      credentials: 'same-origin',
      // Never answer from the HTTP cache: the host's Apache adds long
      // max-age/Expires headers, and a stale copy once hid live data.
      cache: 'no-store',
      ...init,
      headers: init.body ? { 'Content-Type': 'application/json', ...init.headers } : init.headers,
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const fallback = response.status >= 500 ? 'The archive service is unavailable right now.' : 'Request failed.';
    throw new ApiError(response.status, data.error || fallback);
  }
  return data as T;
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

export const archiveApi = {
  session: () => request<SessionInfo>('/api/auth/session'),
  login: (password: string) => post<{ ok: true }>('/api/auth/login', { password }),
  logout: () => post<{ ok: true }>('/api/auth/logout'),
  status: () => request<ArchiveStatus>('/api/archives/status'),
  addChannel: (input: string) => post<{ channel: ArchiveChannel }>('/api/archives/channels', { input }),
  setChannelEnabled: (id: string, enabled: boolean) =>
    request<{ channel: ArchiveChannel }>(`/api/archives/channels/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),
  checkChannel: (id: string) => post<{ channel: ArchiveChannel }>(`/api/archives/channels/${encodeURIComponent(id)}/check`),
  removeChannel: (id: string) => request<{ ok: true }>(`/api/archives/channels/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  stopRecording: (id: string) => post<{ ok: true }>(`/api/archives/recordings/${encodeURIComponent(id)}/stop`),
  retryRecording: (id: string) => post<{ ok: true }>(`/api/archives/recordings/${encodeURIComponent(id)}/retry`),
  storage: () => request<StorageInfo>('/api/archives/storage'),
  youtube: () => request<YouTubeConnection>('/api/archives/youtube'),
  connectYouTube: () => post<{ url: string }>('/api/archives/youtube/connect'),
  disconnectYouTube: () => request<{ ok: true }>('/api/archives/youtube', { method: 'DELETE' }),
  setTags: (id: string, tags: string[]) =>
    request<{ recording: ArchiveRecording }>(`/api/archives/recordings/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ tags }),
    }),
  deleteRecording: (id: string) =>
    request<{ ok: true }>(`/api/archives/recordings/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
