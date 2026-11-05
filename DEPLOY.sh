#!/bin/bash
# Build the frontend and publish dist/ to the DreamHost VPS web root.
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

echo "Building..."
npm run build

STAMP="$(date +%Y%m%d-%H%M%S)"
echo "Backing up current site to ~/backups/$REMOTE_DIR-$STAMP ..."
remote "mkdir -p ~/backups && tar --exclude=.dh-diag -czf ~/backups/$REMOTE_DIR-$STAMP.tgz -C ~ $REMOTE_DIR"

echo "Uploading to $REMOTE_HOST:~/$REMOTE_DIR ..."
# Server-managed entries (.dh-diag symlink, favicons, .git) are left untouched.
sshpass -e rsync -rlvz --delete \
  --exclude=.dh-diag --exclude=.git --exclude=favicon.ico --exclude=favicon.gif \
  -e "ssh $SSH_OPTS" dist/ "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"

# macOS's bundled rsync lacks --chmod, so normalize permissions remotely.
remote "cd ~/$REMOTE_DIR && find . -path ./.git -prune -o -path ./.dh-diag -prune -o -name "favicon.*" -prune -o -type d -exec chmod 755 {} + -o -type f -exec chmod 644 {} +"

echo "Deployed. Remote web root:"
remote "ls -la ~/$REMOTE_DIR"
