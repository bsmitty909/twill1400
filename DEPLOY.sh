#!/bin/bash

echo "🚀 Deploying TWill to DreamHost..."

# Build if not already built
if [ ! -d "dist" ]; then
    echo "📦 Building application..."
    npm run build
fi

echo "📤 Uploading to server..."
scp -r dist/* twill1400@ds15000.dreamservers.com:~/twill1400.com/
scp public/twill.jpg twill1400@ds15000.dreamservers.com:~/twill1400.com/

echo "✅ Deployment complete!"
echo "🌐 Visit: https://twill1400.com"
