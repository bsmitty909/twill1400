import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { config, googleClientConfigured } from '../config';

/*
 * Stores the archive channel's OAuth refresh token on the server, written by
 * the in-app "Connect YouTube" flow. YOUTUBE_REFRESH_TOKEN in .env, if set,
 * takes precedence (useful for the CLI script).
 */

interface StoredAccount {
  refreshToken: string;
  channelId: string;
  channelTitle: string;
  connectedAt: string;
}

const file = () => path.join(config.dataDir, 'youtube-account.json');
let cache: StoredAccount | null | undefined;

function read(): StoredAccount | null {
  if (cache !== undefined) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(file(), 'utf8'));
  } catch {
    cache = null;
  }
  return cache ?? null;
}

export function getRefreshToken(): string {
  return config.google.refreshToken || read()?.refreshToken || '';
}

export function youtubeConfigured(): boolean {
  return googleClientConfigured() && Boolean(getRefreshToken());
}

export function connectedChannel(): { id: string; title: string } | null {
  const account = read();
  return account ? { id: account.channelId, title: account.channelTitle } : null;
}

export function saveAccount(account: Omit<StoredAccount, 'connectedAt'>) {
  fs.mkdirSync(config.dataDir, { recursive: true });
  const value: StoredAccount = { ...account, connectedAt: new Date().toISOString() };
  fs.writeFileSync(file(), JSON.stringify(value, null, 2), { mode: 0o600 });
  cache = value;
}

export function clearAccount() {
  try {
    fs.unlinkSync(file());
  } catch {
    // Not connected.
  }
  cache = null;
}

/* OAuth state values are single-use and expire after 10 minutes. */
const pendingStates = new Map<string, number>();

export function createOAuthState(): string {
  const state = crypto.randomBytes(24).toString('base64url');
  pendingStates.set(state, Date.now() + 10 * 60 * 1000);
  return state;
}

export function consumeOAuthState(state: string): boolean {
  const expiry = pendingStates.get(state);
  pendingStates.delete(state);
  for (const [key, exp] of pendingStates) if (exp < Date.now()) pendingStates.delete(key);
  return Boolean(expiry && expiry > Date.now());
}
