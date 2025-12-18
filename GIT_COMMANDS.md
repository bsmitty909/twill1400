# Git Commands to Push TWill to GitHub

## Push to Your Existing Repository

Since you already have a GitHub repository at https://github.com/bsmitty909/twill1400, use these commands:

```bash
cd /Users/brandonsmith/Desktop/twill

# Check if git is already initialized
git status

# If not initialized, initialize git
git init

# Add the remote repository
git remote add origin https://github.com/bsmitty909/twill1400.git

# Or if remote already exists, update it:
# git remote set-url origin https://github.com/bsmitty909/twill1400.git

# Stage all files
git add .

# Commit with a descriptive message
git commit -m "Phase 1 Complete: TWill multi-stream video player

Features:
- Netflix-inspired modern UI with gradients and glass effects
- 4-slot video grid with resizable panes
- YouTube, Twitch, and Kick support
- Smart audio control (single active slot)
- TWill branding with logo and text
- Error handling with ErrorBoundary
- Scrollable responsive layout
- Unique player IDs for multiple videos
- Modern animations and hover effects"

# Push to GitHub
git push -u origin main

# If the branch is master instead of main:
# git push -u origin master

# If you need to force push (overwrites remote):
# git push -u origin main --force
```

## If You Get Authentication Errors

```bash
# Use GitHub CLI if installed
gh auth login

# Or use a personal access token instead of password
# Go to: https://github.com/settings/tokens
# Create new token with 'repo' scope
# Use token as password when prompted
```

## After Successful Push

Your repository will be available at:
**https://github.com/bsmitty909/twill1400**

## Files Being Pushed

- Complete React application with TypeScript
- All components (Header, NowPlaying, Players, ErrorBoundary)
- Services (URL parser)
- Contexts (VideoContext)
- Modern CSS styling
- Plans and architecture documentation
- Package.json with dependencies
- Vite configuration
- TWill logo image

**Note:** The `.gitignore` file is already configured to exclude:
- node_modules/
- dist/
- .env files
- Build artifacts

Run these commands in your terminal to push to GitHub!
