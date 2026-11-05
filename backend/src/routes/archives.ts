import * as crypto from 'crypto';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { store } from '../store';
import type { Channel } from '../store';
import { resolveChannel } from '../services/ytdlp';
import { checkChannel, discardLocalFile, isRecording, recorderState, retryRecording, stopRecording } from '../services/recorder';
import { deleteVideo } from '../services/youtube';
import { youtubeConfigured } from '../services/youtubeAccount';

const router = Router();

function publicRecording(r: ReturnType<typeof store.recordings>[number]) {
  const { filePath, pid, uploadUrl, ...rest } = r;
  return { ...rest, hasLocalFile: Boolean(filePath) };
}

router.get('/status', (_req: Request, res: Response) => {
  res.json({
    channels: store.channels().map(c => ({ ...c, recording: isRecording(c.id) })),
    recordings: store.recordings().map(publicRecording),
    recorder: recorderState(),
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
  if (recording.youtubeVideoId && req.query.youtube !== 'keep') {
    if (!youtubeConfigured()) return res.status(503).json({ error: 'YouTube is not connected, so the video cannot be deleted there.' });
    try {
      await deleteVideo(recording.youtubeVideoId);
    } catch (error) {
      return res.status(502).json({ error: (error as Error).message });
    }
  }
  discardLocalFile(recording);
  store.removeRecording(recording.id);
  res.json({ ok: true });
});

export default router;
