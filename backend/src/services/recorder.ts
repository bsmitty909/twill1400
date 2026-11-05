import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import type { ChildProcess } from 'child_process';
import { config } from '../config';
import { youtubeConfigured } from './youtubeAccount';
import { store } from '../store';
import type { Channel, Recording } from '../store';
import { checkLive, recordLive } from './ytdlp';
import { uploadVideo } from './youtube';

/*
 * Recording pipeline
 *
 *   poll (every POLL_INTERVAL_SEC) -> channel live? -> yt-dlp records to .ts
 *   -> stream ends / stopped -> ffmpeg remux to .mp4 (no re-encode)
 *   -> upload queue (one at a time) -> YouTube -> local file deleted
 *
 * Every step persists its state in the store so a server restart resumes
 * where it left off: interrupted recordings are finalized and processed,
 * pending uploads are re-queued (resuming the same YouTube upload session).
 */

const active = new Map<string, { child: ChildProcess; channelId: string; stderr: string[] }>();
const uploadQueue: string[] = [];
let uploading = false;
let polling = false;
let pollTimer: NodeJS.Timeout | null = null;

const now = () => new Date().toISOString();

function log(message: string) {
  console.log(`[${now()}] ${message}`);
}

function exec(file: string, args: string[], timeoutMs = 6 * 3600 * 1000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr.trim().split('\n').at(-1) || error.message));
      else resolve(stdout);
    });
  });
}

function fileSize(file: string | null): number {
  try {
    return file ? fs.statSync(file).size : 0;
  } catch {
    return 0;
  }
}

/**
 * yt-dlp picks the extension (and may merge into a different container), so
 * outputs are named `<recording id>.<ext>`; find the largest finished one.
 */
function findOutput(id: string): string | null {
  try {
    const candidates = fs
      .readdirSync(config.recordingsDir)
      .filter(name => name.startsWith(`${id}.`) && !/\.(part|ytdl|temp)$/.test(name) && !/\.f\d+\./.test(name))
      .map(name => path.join(config.recordingsDir, name));
    return candidates.sort((a, b) => fileSize(b) - fileSize(a))[0] ?? null;
  } catch {
    return null;
  }
}

function removeFile(file: string | null) {
  if (!file) return;
  try {
    fs.unlinkSync(file);
  } catch {
    // Already gone.
  }
}

export function isRecording(channelId: string): boolean {
  return [...active.values()].some(a => a.channelId === channelId);
}

// ---------------------------------------------------------------- polling

export async function checkChannel(channel: Channel): Promise<void> {
  if (!channel.enabled || isRecording(channel.id)) return;
  const result = await checkLive(channel.youtubeChannelId);
  const checkedAt = now();

  if ('error' in result) {
    store.updateChannel(channel.id, { status: 'error', lastError: result.error, lastCheckedAt: checkedAt });
    return;
  }
  if (!result.live) {
    store.updateChannel(channel.id, { status: 'idle', lastError: null, lastCheckedAt: checkedAt });
    return;
  }

  store.updateChannel(channel.id, { status: 'live', lastError: null, lastCheckedAt: checkedAt, lastLiveAt: checkedAt });
  if (active.size >= config.maxConcurrentRecordings) {
    store.updateChannel(channel.id, { lastError: `Live, but the limit of ${config.maxConcurrentRecordings} simultaneous recordings is reached.` });
    return;
  }
  startRecording(channel, result.videoId, result.title);
}

async function pollAll() {
  if (polling) return;
  polling = true;
  try {
    for (const channel of store.channels()) {
      try {
        await checkChannel(channel);
      } catch (error) {
        store.updateChannel(channel.id, { status: 'error', lastError: (error as Error).message, lastCheckedAt: now() });
      }
    }
  } finally {
    polling = false;
  }
}

// -------------------------------------------------------------- recording

function startRecording(channel: Channel, videoId: string, title: string) {
  fs.mkdirSync(config.recordingsDir, { recursive: true });
  const id = crypto.randomUUID();
  const outputTemplate = path.join(config.recordingsDir, `${id}.%(ext)s`);
  const child = recordLive(videoId, outputTemplate);
  const stderr: string[] = [];

  const recording: Recording = {
    id,
    channelId: channel.id,
    channelName: channel.name,
    sourceVideoId: videoId,
    sourceTitle: title,
    status: 'recording',
    startedAt: now(),
    endedAt: null,
    durationSec: null,
    sizeBytes: null,
    filePath: null,
    pid: child.pid ?? null,
    uploadUrl: null,
    uploadProgress: null,
    youtubeVideoId: null,
    youtubePrivacy: null,
    error: null,
  };
  store.addRecording(recording);
  active.set(id, { child, channelId: channel.id, stderr });
  log(`Recording started: ${channel.name} (${videoId}) -> ${id}`);

  child.stderr?.setEncoding('utf8');
  child.stderr?.on('data', (chunk: string) => {
    stderr.push(...chunk.split('\n').filter(Boolean));
    if (stderr.length > 40) stderr.splice(0, stderr.length - 40);
  });

  child.on('close', code => {
    active.delete(id);
    const error = stderr.filter(l => l.startsWith('ERROR')).at(-1) ?? null;
    log(`Recording ended: ${channel.name} (${id}) exit=${code}`);
    const output = findOutput(id);
    store.updateRecording(id, { endedAt: now(), pid: null, filePath: output, sizeBytes: fileSize(output), error });
    store.updateChannel(channel.id, { status: 'idle' });
    void processRecording(id);
  });
}

export function stopRecording(id: string): boolean {
  const entry = active.get(id);
  if (!entry) return false;
  entry.child.kill('SIGINT');
  return true;
}

// ------------------------------------------------------------- processing

function uploadTitle(recording: Recording): string {
  const date = recording.startedAt.slice(0, 10);
  const clean = (s: string) => s.replace(/[<>]/g, '').trim();
  return `${clean(recording.channelName)} | ${date} | ${clean(recording.sourceTitle)}`.slice(0, 100);
}

async function processRecording(id: string) {
  const recording = store.recording(id);
  if (!recording) return;
  const source = recording.filePath ?? findOutput(id);

  if (!source || fileSize(source) === 0) {
    removeFile(source);
    store.updateRecording(id, { status: 'failed', filePath: null, error: recording.error || 'No video was captured.' });
    return;
  }

  store.updateRecording(id, { status: 'processing' });
  try {
    // Live HLS arrives as MPEG-TS (whatever the extension); remux to a real
    // MP4 without re-encoding. Already-final files are left as they are.
    let mp4 = source;
    if (!source.endsWith('.final.mp4')) {
      mp4 = path.join(config.recordingsDir, `${id}.final.mp4`);
      await exec(config.ffmpegPath, ['-y', '-loglevel', 'error', '-i', source, '-c', 'copy', '-movflags', '+faststart', mp4]);
      removeFile(source);
    }
    const probe = await exec(config.ffmpegPath.replace(/ffmpeg$/, 'ffprobe'), [
      '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', mp4,
    ]).catch(() => '');
    store.updateRecording(id, {
      filePath: mp4,
      sizeBytes: fileSize(mp4),
      durationSec: Math.round(Number.parseFloat(probe)) || null,
      status: 'queued',
      error: youtubeConfigured() ? null : 'Waiting for a YouTube account to be connected.',
    });
    enqueueUpload(id);
  } catch (error) {
    store.updateRecording(id, { status: 'failed', error: `Processing failed: ${(error as Error).message}` });
  }
}

// ---------------------------------------------------------------- uploads

export function enqueueUpload(id: string) {
  if (!uploadQueue.includes(id)) uploadQueue.push(id);
  void drainUploads();
}

async function drainUploads() {
  if (uploading || !youtubeConfigured()) return;
  uploading = true;
  try {
    while (uploadQueue.length) {
      const id = uploadQueue.shift()!;
      const recording = store.recording(id);
      if (!recording?.filePath || !fs.existsSync(recording.filePath)) {
        if (recording && recording.status !== 'uploaded') {
          store.updateRecording(id, { status: 'failed', error: 'Local file is missing; nothing to upload.' });
        }
        continue;
      }

      store.updateRecording(id, { status: 'uploading', error: null, uploadProgress: recording.uploadProgress ?? 0 });
      let lastSaved = 0;
      try {
        const result = await uploadVideo(
          recording.filePath,
          {
            title: uploadTitle(recording),
            description: [
              `Live recording of ${recording.channelName}.`,
              `Original stream: https://www.youtube.com/watch?v=${recording.sourceVideoId}`,
              `Original title: ${recording.sourceTitle}`,
              `Recorded: ${recording.startedAt} - ${recording.endedAt ?? 'unknown'} (UTC)`,
            ].join('\n'),
            tags: ['twill-archive', recording.channelName],
            recordingDate: recording.startedAt,
          },
          {
            sessionUrl: recording.uploadUrl,
            onSession: url => store.updateRecording(id, { uploadUrl: url }),
            onProgress: fraction => {
              if (fraction - lastSaved >= 0.02 || fraction === 1) {
                lastSaved = fraction;
                store.updateRecording(id, { uploadProgress: fraction });
              }
            },
          }
        );
        removeFile(recording.filePath);
        store.updateRecording(id, {
          status: 'uploaded',
          youtubeVideoId: result.videoId,
          youtubePrivacy: result.privacyStatus,
          filePath: null,
          uploadUrl: null,
          uploadProgress: 1,
        });
        log(`Uploaded ${id} -> ${result.videoId} (${result.privacyStatus})`);
      } catch (error) {
        const message = (error as Error).message;
        store.updateRecording(id, {
          status: 'failed',
          error: `Upload failed: ${message}`,
          uploadUrl: /expired/i.test(message) ? null : store.recording(id)?.uploadUrl ?? null,
        });
        log(`Upload failed for ${id}: ${message}`);
      }
    }
  } finally {
    uploading = false;
  }
}

/** Called once YouTube gets connected: push everything that was waiting. */
export function resumePendingUploads() {
  for (const recording of store.recordings()) {
    if (recording.status === 'queued') {
      store.updateRecording(recording.id, { error: null });
      enqueueUpload(recording.id);
    }
  }
}

export function retryRecording(id: string): boolean {
  const recording = store.recording(id);
  if (!recording || recording.status !== 'failed' || !recording.filePath || !fs.existsSync(recording.filePath)) return false;
  if (!recording.filePath.endsWith('.final.mp4')) {
    void processRecording(id);
  } else {
    store.updateRecording(id, { status: 'queued', error: null });
    enqueueUpload(id);
  }
  return true;
}

export function discardLocalFile(recording: Recording) {
  removeFile(recording.filePath);
}

// -------------------------------------------------------------- lifecycle

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').includes('yt-dlp');
  } catch {
    return false;
  }
}

/*
 * After a crash or restart, yt-dlp children may be orphaned and still
 * writing. Stop them cleanly, then push every unfinished recording back
 * through the pipeline.
 */
async function recover() {
  for (const recording of store.recordings()) {
    if (recording.status === 'recording') {
      if (recording.pid && processAlive(recording.pid)) {
        process.kill(recording.pid, 'SIGINT');
        for (let i = 0; i < 30 && processAlive(recording.pid); i++) await new Promise(r => setTimeout(r, 500));
      }
      const output = recording.filePath ?? findOutput(recording.id);
      store.updateRecording(recording.id, { pid: null, endedAt: recording.endedAt ?? now(), filePath: output, sizeBytes: fileSize(output) });
      void processRecording(recording.id);
    } else if (recording.status === 'processing') {
      void processRecording(recording.id);
    } else if (recording.status === 'queued' || recording.status === 'uploading') {
      enqueueUpload(recording.id);
    }
  }
  for (const channel of store.channels()) {
    if (channel.status === 'live') store.updateChannel(channel.id, { status: 'idle' });
  }
}

export async function startRecorder() {
  await recover();
  void pollAll();
  pollTimer = setInterval(() => void pollAll(), config.pollIntervalSec * 1000);
  log(`Recorder running: polling every ${config.pollIntervalSec}s, YouTube uploads ${youtubeConfigured() ? 'enabled' : 'NOT configured'}`);
}

export async function stopRecorder() {
  if (pollTimer) clearInterval(pollTimer);
  const exits = [...active.values()].map(
    ({ child }) => new Promise<void>(resolve => {
      child.once('close', () => resolve());
      child.kill('SIGINT');
      setTimeout(resolve, 15_000);
    })
  );
  await Promise.all(exits);
}

export function recorderState() {
  return {
    activeRecordings: active.size,
    uploadQueue: uploadQueue.length,
    uploading,
    youtubeConfigured: youtubeConfigured(),
    pollIntervalSec: config.pollIntervalSec,
  };
}
