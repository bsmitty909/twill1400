import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env') });

const ROOT = path.join(__dirname, '..');

function int(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const config = {
  port: int('PORT', 38411),
  host: process.env.HOST || '127.0.0.1',
  isProduction: process.env.NODE_ENV === 'production',

  dataDir: process.env.DATA_DIR || path.join(ROOT, 'data'),
  recordingsDir: process.env.RECORDINGS_DIR || path.join(ROOT, 'recordings'),

  ytDlpPath: process.env.YT_DLP_PATH || 'yt-dlp',
  ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
  /** yt-dlp format selector; capped to save space and upload time. */
  // Live streams expose muxed HLS formats, so `b` yields one file with audio.
  recordFormat: process.env.RECORD_FORMAT || `b[height<=${int('RECORD_MAX_HEIGHT', 720)}]/bv*[height<=${int('RECORD_MAX_HEIGHT', 720)}]+ba/b`,
  pollIntervalSec: int('POLL_INTERVAL_SEC', 120),
  maxConcurrentRecordings: int('MAX_CONCURRENT_RECORDINGS', 4),

  archivePasswordHash: process.env.ARCHIVE_PASSWORD_HASH || '',
  sessionSecret: process.env.SESSION_SECRET || '',
  sessionTtlHours: int('SESSION_TTL_HOURS', 24 * 14),

  /** Public origin used for the OAuth redirect, e.g. https://twill1400.com */
  publicUrl: (process.env.PUBLIC_URL || 'https://twill1400.com').replace(/\/+$/, ''),

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    refreshToken: process.env.YOUTUBE_REFRESH_TOKEN || '',
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT || '',
    bucket: process.env.S3_BUCKET || '',
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    region: process.env.S3_REGION || 'us-east-005',
  },
  /** Where finished recordings go: DreamObjects ('s3') or YouTube. */
  archiveTarget: (process.env.ARCHIVE_TARGET === 'youtube' ? 'youtube' : 's3') as 's3' | 'youtube',
  /** Recordings older than this are deleted from storage (0 = keep forever). */
  retentionDays: Number.isFinite(Number(process.env.RETENTION_DAYS)) && process.env.RETENTION_DAYS !== '' && process.env.RETENTION_DAYS !== undefined
    ? Math.max(0, Number(process.env.RETENTION_DAYS))
    : 30,

  youtubePrivacy: (['unlisted', 'private', 'public'].includes(process.env.YOUTUBE_PRIVACY || '')
    ? process.env.YOUTUBE_PRIVACY
    : 'unlisted') as 'unlisted' | 'private' | 'public',
};

export function googleClientConfigured(): boolean {
  return Boolean(config.google.clientId && config.google.clientSecret);
}
