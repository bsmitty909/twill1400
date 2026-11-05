#!/bin/bash
# Started every minute by cron under flock; exits immediately if the backend
# already holds the lock, so exactly one instance runs and crashes self-heal.
cd "$(dirname "$0")"
export PATH="$HOME/bin:$PATH"
mkdir -p logs
echo $$ > run.pid
exec node dist/server.js >> logs/server.log 2>&1
