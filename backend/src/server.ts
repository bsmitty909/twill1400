import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { config } from './config';
import { youtubeConfigured } from './services/youtubeAccount';
import { authConfigured, isAuthenticated, login, logout, requireAuth } from './auth';
import archiveRoutes from './routes/archives';
import { youtubeAdminRouter, youtubeCallbackRouter } from './routes/youtubeConnect';
import uploadRoutes from './routes/upload';
import downloadRoutes from './routes/download';
import { startRecorder, stopRecorder } from './services/recorder';

const app = express();

// Apache proxies to us from the same host; trust its X-Forwarded-For.
app.set('trust proxy', 'loopback');
app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));

// Nothing the API returns may be indexed, cached by shared caches, or leak
// presigned media URLs through the Referer header.
app.use('/api', (_req, res, next) => {
  res.set({
    'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
    'Cache-Control': 'private, no-store',
    'Referrer-Policy': 'no-referrer',
  });
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/auth/session', (req, res) => {
  res.json({ authenticated: isAuthenticated(req), configured: authConfigured(), youtubeConfigured: youtubeConfigured() });
});
app.post('/api/auth/login', login);
app.post('/api/auth/logout', logout);

app.use('/api/archives', requireAuth, archiveRoutes);
app.use('/api/archives', requireAuth, youtubeAdminRouter);
app.use('/api', youtubeCallbackRouter);
// Legacy cloud-download endpoints: private, never open to anonymous visitors.
app.use('/api', requireAuth, uploadRoutes);
app.use('/api', requireAuth, downloadRoutes);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(config.port, config.host, () => {
  console.log(`[${new Date().toISOString()}] TWill backend listening on http://${config.host}:${config.port}`);
  if (!authConfigured()) console.warn('ARCHIVE_PASSWORD_HASH / SESSION_SECRET not set: Archives login is disabled.');
  void startRecorder();
});

async function shutdown(signal: string) {
  console.log(`[${new Date().toISOString()}] ${signal}: stopping recordings and shutting down`);
  server.close();
  await stopRecorder();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
