# Deploy TWill to DreamHost VPS

## Target

| Item | Value |
|---|---|
| Server | `vps28083.dreamhostps.com` (173.236.216.207) |
| SSH user | `SSH_user` in `backend/.env` |
| Web root | `~/twill1400.com` (Apache, static files) |
| Site URL | https://twill1400.com |

The site is a static Vite build. Apache serves `dist/` as-is; `public/.htaccess` ships with it (cache headers, security headers, blocks `/.git`).

## Credentials

`backend/.env` (gitignored) must contain:

```env
ssh_host=vps28083.dreamhostps.com
SSH_user=...
SSH_pass=...
```

## Deploy

```bash
./DEPLOY.sh
```

What it does:

1. `npm run build`
2. Backs up the live web root to `~/backups/twill1400.com-<timestamp>.tgz` on the server
3. `rsync --delete` of `dist/` into `~/twill1400.com/` (files 644, dirs 755); leaves `.dh-diag`, `.git`, `favicon.*` alone

Requires `sshpass`, `rsync`, and `node` locally.

## Verify

```bash
curl -sI https://twill1400.com            # 200, server: Apache
curl -s https://twill1400.com | grep assets/index-   # hash matches local dist/index.html
```

## Rollback

```bash
ssh <user>@vps28083.dreamhostps.com
cd ~ && tar -xzf backups/twill1400.com-<timestamp>.tgz
```

## DNS

`twill1400.com` must resolve to the VPS (173.236.216.207). If `dig +short twill1400.com` returns another IP, the domain is still served by the old server; update hosting for the domain in the DreamHost panel (Websites -> Manage) so DNS and the Let's Encrypt certificate move to `vps28083`.

## Backend (Archives recorder)

Runs as `twilldev` (no root) in `~/twill-backend`, bound to `127.0.0.1:38411`. Apache forwards `/api/*` to it via the `[P]` rule in `public/.htaccess`.

| Piece | Location / mechanism |
|---|---|
| Code | `~/twill-backend/dist` (deployed by `DEPLOY.sh`) |
| Data | `~/twill-backend/data/archives.json` (channels + recordings) |
| Temp video | `~/twill-backend/recordings/` (deleted after upload) |
| Logs | `~/twill-backend/logs/server.log` (trimmed nightly above 50 MB) |
| yt-dlp | `~/bin/yt-dlp`, self-updates nightly (`yt-dlp -U`) |
| Keep-alive | cron every minute: `flock -n .run.lock run.sh` (restarts on crash/reboot) |

Restart: `kill -TERM $(cat ~/twill-backend/run.pid)`; cron starts it again within a minute. SIGTERM finalizes in-progress recordings first (they upload; the next poll starts a new part if the stream is still live).

### Server settings (`~/twill-backend/.env`, mode 600)

`DEPLOY.sh` creates `NODE_ENV`, `HOST`, `PORT`, `YT_DLP_PATH` and a random `SESSION_SECRET` if missing. Add the rest by hand on the server:

| Variable | Purpose |
|---|---|
| `ARCHIVE_PASSWORD_HASH` | Archives password, scrypt hash: `echo -n 'pw' \| node dist/scripts/hashPassword.js` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth client (type "Web application") from the Google Cloud project |
| `PUBLIC_URL` | Origin for the OAuth redirect, default `https://twill1400.com` |
| `YOUTUBE_PRIVACY` | `unlisted` (default), `private`, or `public` |
| `RECORD_MAX_HEIGHT` | Max recorded resolution, default `720` (~500 MB/hour) |
| `POLL_INTERVAL_SEC` | Live check interval, default `120` |
| `MAX_CONCURRENT_RECORDINGS` | Default `4` |

### Google / YouTube setup

1. console.cloud.google.com -> new project -> enable **YouTube Data API v3**
2. OAuth consent screen: External, add the archive channel's Google account as a test user, then **Publish app** ("In production"); in Testing mode refresh tokens expire after 7 days
3. Credentials -> Create OAuth client ID -> **Web application**, authorized redirect URI `https://twill1400.com/api/youtube/callback`
4. Put the client ID/secret in `~/twill-backend/.env` and restart the backend
5. Archives tab -> **Connect YouTube** -> sign in with the archive channel's Google account. The refresh token is stored server-side in `~/twill-backend/data/youtube-account.json` (mode 600)

Limits:
- Uploads from API projects that have not passed the YouTube API compliance audit are forced to **private** (only the channel owner can watch). The Archives tab flags these. Request the audit at https://support.google.com/youtube/contact/yt_api_form to get unlisted uploads.
- Default quota is 10,000 units/day; each upload costs 1,600, so about 6 uploads per day.

## Cloud download backend (optional)

The per-tile "Save to cloud" button only appears when the frontend is built with `VITE_API_URL` pointing at a running `backend/` instance (yt-dlp + S3-compatible storage). It is not deployed today. Backend settings live in `backend/.env` (`B2_*` keys); never commit real values.
