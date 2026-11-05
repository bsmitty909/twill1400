import * as crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from './config';

/*
 * Single shared password for the Archives area.
 *
 * - The password is stored only as `scrypt$<salt>$<hash>` (ARCHIVE_PASSWORD_HASH);
 *   generate it with `npm run hash-password`.
 * - A successful login sets an HttpOnly, Secure, SameSite=Strict cookie holding
 *   `<expiry>.<hmac>` signed with SESSION_SECRET. Rotating the secret logs
 *   everyone out.
 * - Failed logins are rate limited per client IP.
 */

const COOKIE = 'twill_archive';
const MAX_FAILURES = 8;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const failures = new Map<string, { count: number; first: number }>();

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

function sign(value: string): string {
  return crypto.createHmac('sha256', config.sessionSecret).update(value).digest('base64url');
}

function readCookie(req: Request, name: string): string | null {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function isValidSession(token: string | null): boolean {
  if (!token || !config.sessionSecret) return false;
  const [expiry, signature] = token.split('.');
  if (!expiry || !signature) return false;
  const expected = Buffer.from(sign(expiry));
  const given = Buffer.from(signature);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given) && Number(expiry) > Date.now();
}

export function authConfigured(): boolean {
  return Boolean(config.archivePasswordHash && config.sessionSecret);
}

export function isAuthenticated(req: Request): boolean {
  return isValidSession(readCookie(req, COOKIE));
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (isAuthenticated(req)) return next();
  res.status(401).json({ error: 'Not signed in' });
}

export function login(req: Request, res: Response) {
  if (!authConfigured()) {
    return res.status(503).json({ error: 'Archives password is not configured on the server.' });
  }

  const ip = req.ip ?? 'unknown';
  const now = Date.now();
  const record = failures.get(ip);
  if (record && now - record.first < FAILURE_WINDOW_MS && record.count >= MAX_FAILURES) {
    return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  }

  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!password || !verifyPassword(password, config.archivePasswordHash)) {
    const fresh = !record || now - record.first >= FAILURE_WINDOW_MS;
    failures.set(ip, fresh ? { count: 1, first: now } : { ...record, count: record.count + 1 });
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  failures.delete(ip);
  const expiry = String(now + config.sessionTtlHours * 3600 * 1000);
  res.cookie(COOKIE, `${expiry}.${sign(expiry)}`, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/api',
    maxAge: config.sessionTtlHours * 3600 * 1000,
  });
  res.json({ ok: true });
}

export function logout(_req: Request, res: Response) {
  res.clearCookie(COOKIE, { path: '/api' });
  res.json({ ok: true });
}
