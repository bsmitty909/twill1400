#!/bin/bash

cd "$(dirname "$0")"

echo "🔄 Restarting TWill Backend Server..."
echo ""

# Kill any running backend
pkill -f "ts-node.*server.ts" 2>/dev/null || true
pkill -f "node.*dist/server.js" 2>/dev/null || true

echo "✅ Stopped old server"
sleep 1

# Check if yt-dlp is installed
if command -v yt-dlp &> /dev/null; then
    echo "✅ yt-dlp is installed"
else
    echo "⚠️  yt-dlp not found. Install with: brew install yt-dlp"
fi

echo ""
echo "🚀 Starting backend server..."
npm run dev
