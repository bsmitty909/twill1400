#!/bin/bash

echo "Restarting TWill Backend Server..."

# Find and kill the backend process
pkill -f "ts-node src/server.ts"

# Wait a moment
sleep 1

# Start the backend again
cd backend && npm run dev
