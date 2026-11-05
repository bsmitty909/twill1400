import { Router } from 'express';
import type { Request, Response } from 'express';
import { config, googleClientConfigured } from '../config';
import { clearAccount, connectedChannel, consumeOAuthState, createOAuthState, saveAccount } from '../services/youtubeAccount';
import { resetTokenCache } from '../services/youtube';
import { resumePendingUploads } from '../services/recorder';

/*
 * In-app OAuth: an authenticated Archives user starts the flow, signs in to
 * the archive channel's Google account, and Google redirects back to the
 * public callback. The callback cannot rely on the SameSite=Strict session
 * cookie (cross-site redirect), so it is guarded by a single-use state value
 * that only an authenticated user could have obtained.
 */

const SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl';
const redirectUri = () => `${config.publicUrl}/api/youtube/callback`;

/** Mounted behind requireAuth under /api/archives. */
export const youtubeAdminRouter = Router();

youtubeAdminRouter.get('/youtube', (_req: Request, res: Response) => {
  res.json({
    clientConfigured: googleClientConfigured(),
    channel: connectedChannel(),
    privacy: config.youtubePrivacy,
    redirectUri: redirectUri(),
  });
});

youtubeAdminRouter.post('/youtube/connect', (_req: Request, res: Response) => {
  if (!googleClientConfigured()) {
    return res.status(503).json({ error: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set on the server.' });
  }
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent select_account',
    state: createOAuthState(),
  }).toString();
  res.json({ url: url.toString() });
});

youtubeAdminRouter.delete('/youtube', (_req: Request, res: Response) => {
  clearAccount();
  resetTokenCache();
  res.json({ ok: true });
});

/** Public: Google redirects the browser here. */
export const youtubeCallbackRouter = Router();

youtubeCallbackRouter.get('/youtube/callback', async (req: Request, res: Response) => {
  const back = (params: Record<string, string>) => res.redirect(`/archives?${new URLSearchParams(params)}`);
  const { code, state, error } = req.query;

  if (typeof state !== 'string' || !consumeOAuthState(state)) return back({ youtube_error: 'Sign-in link expired. Try connecting again.' });
  if (error) return back({ youtube_error: `Google returned: ${String(error)}` });
  if (typeof code !== 'string') return back({ youtube_error: 'Missing authorization code.' });

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        redirect_uri: redirectUri(),
        grant_type: 'authorization_code',
      }),
    });
    const tokens = (await tokenResponse.json()) as { access_token?: string; refresh_token?: string; error_description?: string; error?: string };
    if (!tokenResponse.ok || !tokens.access_token) throw new Error(tokens.error_description || tokens.error || 'Token exchange failed');
    if (!tokens.refresh_token) throw new Error('Google did not return a refresh token. Remove TWill at myaccount.google.com/permissions and connect again.');

    const channelResponse = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const channels = (await channelResponse.json()) as { items?: { id: string; snippet: { title: string } }[] };
    const channel = channels.items?.[0];
    if (!channel) throw new Error('That Google account has no YouTube channel. Create the channel first, then connect again.');

    saveAccount({ refreshToken: tokens.refresh_token, channelId: channel.id, channelTitle: channel.snippet.title });
    resetTokenCache();
    resumePendingUploads();
    back({ youtube: 'connected' });
  } catch (err) {
    back({ youtube_error: (err as Error).message.slice(0, 200) });
  }
});
