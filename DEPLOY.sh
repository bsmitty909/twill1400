#!/bin/bash
# Build and publish the frontend (web root) and the backend (~/twill-backend,
# kept alive by cron) to the DreamHost VPS.
#
# Credentials come from backend/.env (gitignored):
#   ssh_host=vps28083.dreamhostps.com
#   SSH_user=<sftp/ssh user>
#   SSH_pass=<password>
# Requires: sshpass, rsync, node.
set -euo pipefail
cd "$(dirname "$0")"

ENV_FILE=backend/.env
REMOTE_DIR=twill1400.com
BACKEND_DIR=twill-backend

read_env() {
  node -e '
    const text = require("fs").readFileSync(process.argv[1], "utf8");
    const m = text.match(new RegExp("^" + process.argv[2] + "\\s*=\\s*(.*)$", "m"));
    process.stdout.write(m ? m[1].trim().replace(/^["\x27]|["\x27]$/g, "") : "");
  ' "$ENV_FILE" "$1"
}

SSHPASS="$(read_env SSH_pass)"; export SSHPASS
REMOTE_USER="$(read_env SSH_user)"
REMOTE_HOST="$(read_env ssh_host)"
[ -n "$SSHPASS" ] && [ -n "$REMOTE_USER" ] && [ -n "$REMOTE_HOST" ] || { echo "Missing ssh_host/SSH_user/SSH_pass in $ENV_FILE" >&2; exit 1; }

SSH_OPTS="-o StrictHostKeyChecking=accept-new -o PubkeyAuthentication=no -o PreferredAuthentications=password,keyboard-interactive"
remote() { sshpass -e ssh $SSH_OPTS "$REMOTE_USER@$REMOTE_HOST" "$@"; }

echo "Building frontend and backend..."
npm run build
(cd backend && npm ci --no-audit --no-fund && npm run build)
# The VPS has node but no npm: install production deps locally (all pure JS,
# no native addons) and ship them.
rm -rf tmp/backend-prod && mkdir -p tmp/backend-prod
cp backend/package.json backend/package-lock.json tmp/backend-prod/
(cd tmp/backend-prod && npm ci --omit=dev --no-audit --no-fund --silent)
if find tmp/backend-prod/node_modules -name '*.node' | grep -q .; then
  echo "Native addon found in backend deps; cannot ship prebuilt node_modules." >&2; exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
echo "Backing up current site to ~/backups/$REMOTE_DIR-$STAMP ..."
remote "mkdir -p ~/backups && tar --exclude=.dh-diag -czf ~/backups/$REMOTE_DIR-$STAMP.tgz -C ~ $REMOTE_DIR"

echo "Uploading to $REMOTE_HOST:~/$REMOTE_DIR ..."
# Server-managed entries (.dh-diag symlink, favicons, .git) are left untouched.
sshpass -e rsync -rlvz --delete \
  --exclude=.dh-diag --exclude=.git --exclude=favicon.ico --exclude=favicon.gif \
  -e "ssh $SSH_OPTS" dist/ "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"

# macOS's bundled rsync lacks --chmod, so normalize permissions remotely.
remote "cd ~/$REMOTE_DIR && find . -path ./.git -prune -o -path ./.dh-diag -prune -o -name 'favicon.*' -prune -o -type d -exec chmod 755 {} + -o -type f -exec chmod 644 {} +"

echo "Deploying backend to ~/$BACKEND_DIR ..."
remote "mkdir -p ~/$BACKEND_DIR ~/bin && chmod 700 ~/$BACKEND_DIR"
sshpass -e rsync -rlz --delete -e "ssh $SSH_OPTS" backend/dist/ "$REMOTE_USER@$REMOTE_HOST:$BACKEND_DIR/dist/"
sshpass -e rsync -rlz --delete -e "ssh $SSH_OPTS" tmp/backend-prod/node_modules/ "$REMOTE_USER@$REMOTE_HOST:$BACKEND_DIR/node_modules/"
sshpass -e rsync -lz -e "ssh $SSH_OPTS" backend/package.json backend/package-lock.json backend/deploy/run.sh backend/deploy/crontab.txt "$REMOTE_USER@$REMOTE_HOST:$BACKEND_DIR/"
# Server-only settings; secrets (password hash, Google OAuth) are added
# separately and never leave the server. SESSION_SECRET is generated there.
remote "bash -s" <<REMOTE
set -e
cd ~/$BACKEND_DIR
chmod 755 run.sh
[ -x ~/bin/yt-dlp ] || { curl -sSL -o ~/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp && chmod 755 ~/bin/yt-dlp; }
touch .env && chmod 600 .env
grep -q '^SESSION_SECRET=' .env || echo "SESSION_SECRET=\$(openssl rand -hex 32)" >> .env
for kv in NODE_ENV=production HOST=127.0.0.1 PORT=38411 YT_DLP_PATH=\$HOME/bin/yt-dlp; do
  grep -q "^\${kv%%=*}=" .env || echo "\$kv" >> .env
done
crontab crontab.txt
# Graceful restart: SIGTERM finalizes any in-progress recordings first.
if [ -f run.pid ] && kill -0 \$(cat run.pid) 2>/dev/null; then
  kill -TERM \$(cat run.pid)
  for i in \$(seq 1 40); do kill -0 \$(cat run.pid) 2>/dev/null || break; sleep 0.5; done
fi
nohup /usr/bin/flock -n .run.lock ./run.sh >/dev/null 2>&1 &
sleep 3
curl -sf http://127.0.0.1:38411/api/health && echo
REMOTE

echo "Deployed. Remote web root:"
remote "ls -la ~/$REMOTE_DIR"
