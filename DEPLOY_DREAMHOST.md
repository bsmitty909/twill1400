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

## Cloud download backend (optional)

The per-tile "Save to cloud" button only appears when the frontend is built with `VITE_API_URL` pointing at a running `backend/` instance (yt-dlp + S3-compatible storage). It is not deployed today. Backend settings live in `backend/.env` (`B2_*` keys); never commit real values.
