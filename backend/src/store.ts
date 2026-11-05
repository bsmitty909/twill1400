import * as fs from 'fs';
import * as path from 'path';
import { config } from './config';

export type ChannelStatus = 'idle' | 'live' | 'error';

export interface Channel {
  id: string;
  youtubeChannelId: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  enabled: boolean;
  status: ChannelStatus;
  lastCheckedAt: string | null;
  lastLiveAt: string | null;
  lastError: string | null;
  addedAt: string;
}

export type RecordingStatus = 'recording' | 'processing' | 'queued' | 'uploading' | 'uploaded' | 'failed';

export interface Recording {
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
  /** Absolute path of the local file while it still exists. */
  filePath: string | null;
  pid: number | null;
  uploadUrl: string | null;
  uploadProgress: number | null;
  youtubeVideoId: string | null;
  youtubePrivacy: string | null;
  error: string | null;
}

interface Database {
  channels: Channel[];
  recordings: Recording[];
}

/*
 * Tiny JSON-file database. The data set is small (tens of channels, hundreds
 * of recordings), so the whole document lives in memory and every mutation is
 * flushed with write-to-temp + rename, which is atomic on the same filesystem.
 */
class Store {
  private db: Database;
  private readonly file: string;

  constructor() {
    fs.mkdirSync(config.dataDir, { recursive: true });
    this.file = path.join(config.dataDir, 'archives.json');
    this.db = this.load();
  }

  private load(): Database {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      return { channels: parsed.channels ?? [], recordings: parsed.recordings ?? [] };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return { channels: [], recordings: [] };
    }
  }

  private flush() {
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.db, null, 2));
    fs.renameSync(tmp, this.file);
  }

  channels(): Channel[] {
    return this.db.channels;
  }

  recordings(): Recording[] {
    return this.db.recordings;
  }

  channel(id: string): Channel | undefined {
    return this.db.channels.find(c => c.id === id);
  }

  recording(id: string): Recording | undefined {
    return this.db.recordings.find(r => r.id === id);
  }

  addChannel(channel: Channel) {
    this.db.channels.push(channel);
    this.flush();
  }

  updateChannel(id: string, patch: Partial<Channel>): Channel | undefined {
    const channel = this.channel(id);
    if (!channel) return undefined;
    Object.assign(channel, patch);
    this.flush();
    return channel;
  }

  removeChannel(id: string) {
    this.db.channels = this.db.channels.filter(c => c.id !== id);
    this.flush();
  }

  addRecording(recording: Recording) {
    this.db.recordings.unshift(recording);
    this.flush();
  }

  updateRecording(id: string, patch: Partial<Recording>): Recording | undefined {
    const recording = this.recording(id);
    if (!recording) return undefined;
    Object.assign(recording, patch);
    this.flush();
    return recording;
  }

  removeRecording(id: string) {
    this.db.recordings = this.db.recordings.filter(r => r.id !== id);
    this.flush();
  }
}

export const store = new Store();
