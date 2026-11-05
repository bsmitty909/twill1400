import * as crypto from 'crypto';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { store } from '../store';
import type { Channel } from '../store';
import { resolveChannel } from '../services/ytdlp';
import { checkChannel, downloadName, expiresAt, isRecording, purgeRecording, recorderState, retryRecording, stopRecording } from '../services/recorder';
import { checkBucket, presignedUrl, storageConfigured } from '../services/objectStorage';
import { config } from '../config';
import { youtubeConfigured } from '../services/youtubeAccount';

const router = Router();

function publicRecording(r: ReturnType<typeof store.recordings>[number]) {
  const { filePath, pid, uploadUrl, storageKey, thumbnailKey, ...rest } = r;
  return {
    ...rest,
    storage: r.storage ?? (r.youtubeVideoId ? 'youtube' : null),
    hasLocalFile: Boolean(filePath),
    hasMedia: Boolean(storageKey),
    hasThumbnail: Boolean(thumbnailKey),
    expiresAt: expiresAt(r),
  };
}

router.get('/status', (_req: Request, res: Response) => {
  res.json({
    channels: store.channels().map(c => ({ ...c, recording: isRecording(c.id) })),
    recordings: store.recordings().map(publicRecording),
    recorder: recorderState(),
  });
});

router.get('/storage', async (_req: Request, res: Response) => {
  res.json({
    target: config.archiveTarget,
    configured: storageConfigured(),
    bucket: config.s3.bucket || null,
    retentionDays: config.retentionDays,
    error: storageConfigured() ? await checkBucket() : null,
  });
});

router.post('/channels', async (req: Request, res: Response) => {
  const input = typeof req.body?.input === 'string' ? req.body.input : '';
  try {
    const resolved = await resolveChannel(input);
    if (store.channels().some(c => c.youtubeChannelId === resolved.youtubeChannelId)) {
      return res.status(409).json({ error: `${resolved.name} is already in the list.` });
    }
    const channel: Channel = {
      id: crypto.randomUUID(),
      ...resolved,
      enabled: true,
      status: 'idle',
      lastCheckedAt: null,
      lastLiveAt: null,
      lastError: null,
      addedAt: new Date().toISOString(),
    };
    store.addChannel(channel);
    void checkChannel(channel).catch(() => undefined);
    res.status(201).json({ channel });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.patch('/channels/:id', (req: Request, res: Response) => {
  const enabled = req.body?.enabled;
  if (typeof enabled !== 'boolean') return res.status(400).json({ error: '`enabled` must be true or false.' });
  const channel = store.updateChannel(req.params.id, { enabled });
  if (!channel) return res.status(404).json({ error: 'Channel not found.' });
  if (enabled) void checkChannel(channel).catch(() => undefined);
  res.json({ channel });
});

router.post('/channels/:id/check', async (req: Request, res: Response) => {
  const channel = store.channel(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found.' });
  try {
    await checkChannel({ ...channel, enabled: true });
    res.json({ channel: store.channel(channel.id) });
  } catch (error) {
    res.status(502).json({ error: (error as Error).message });
  }
});

router.delete('/channels/:id', (req: Request, res: Response) => {
  const channel = store.channel(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found.' });
  for (const recording of store.recordings()) {
    if (recording.channelId === channel.id && recording.status === 'recording') stopRecording(recording.id);
  }
  store.removeChannel(channel.id);
  res.json({ ok: true });
});

router.post('/recordings/:id/stop', (req: Request, res: Response) => {
  if (!stopRecording(req.params.id)) return res.status(409).json({ error: 'That recording is not in progress.' });
  res.json({ ok: true });
});

router.post('/recordings/:id/retry', (req: Request, res: Response) => {
  if (!retryRecording(req.params.id)) return res.status(409).json({ error: 'Nothing to retry for this recording.' });
  res.json({ ok: true });
});

router.delete('/recordings/:id', async (req: Request, res: Response) => {
  const recording = store.recording(req.params.id);
  if (!recording) return res.status(404).json({ error: 'Recording not found.' });
  if (['recording', 'processing', 'uploading'].includes(recording.status)) {
    return res.status(409).json({ error: 'Stop the recording or wait for it to finish before deleting.' });
  }
  if (recording.youtubeVideoId && !youtubeConfigured() && req.query.youtube !== 'keep') {
    return res.status(503).json({ error: 'YouTube is not connected, so the video cannot be deleted there.' });
  }
  try {
    await purgeRecording(recording, { keepYouTube: req.query.youtube === 'keep' });
    res.json({ ok: true });
  } catch (error) {
    res.status(502).json({ error: (error as Error).message });
  }
});

/*
 * Stable, cookie-authenticated media URLs that redirect to a fresh presigned
 * DreamObjects URL. The viewer can store /media in a slot and it keeps
 * working after any individual presigned URL expires.
 */
router.get('/recordings/:id/media', async (req: Request, res: Response) => {
  const recording = store.recording(req.params.id);
  if (!recording?.storageKey) return res.status(404).json({ error: 'This recording is not in storage.' });
  const url = await presignedUrl(recording.storageKey, req.query.download ? downloadName(recording) : undefined);
  res.set('Cache-Control', 'private, no-store').redirect(302, url);
});

router.get('/recordings/:id/thumbnail', async (req: Request, res: Response) => {
  const recording = store.recording(req.params.id);
  if (!recording?.thumbnailKey) return res.status(404).end();
  res.set('Cache-Control', 'private, max-age=3000').redirect(302, await presignedUrl(recording.thumbnailKey));
});

export default router;
