# TWill - The Content Plug

Multi-stream viewer: watch up to 8 YouTube, Twitch, Kick, or custom iframe streams side by side, with one-click audio switching and resizable, rearrangeable tiles.

Live: https://twill1400.com

## Features

- **8 slots** - YouTube videos/lives/shorts, Twitch channels and VODs (`/videos/<id>`), Kick channels, and any other URL or pasted `<iframe>` embed code
- **Phones/tablets** (< 900px) get a stacked 16:9 list
- **Audio** - exactly one stream is audible; pick it with a tile's speaker icon or the 1-8 chips in the toolbar; "Mute all" remembers the last source
- **Arrange** - drag a tile by its grip onto another slot to swap them
- **Session persistence** - streams and layout survive a reload (localStorage)
- **Layouts** - Stage, Spotlight, Theater, Grid (column count selectable); every divider resizes live and is remembered per layout; "make main" and per-tile fullscreen (double-click)
- **Live chat** - resizable side panel showing YouTube, Twitch, or Kick chat for any slot
- **Customize** - tile spacing, stream labels, reset pane sizes; **Focus mode** hides everything but the streams
- **Start screen** - paste one link or a whole list, "Try a demo", one-click re-add from recently watched
- **Saved setups** - name and save the current streams + layout; reload from the toolbar or start screen
- **Share links** - copies a URL (`/#watch=...`) that opens the same setup; recipients see exactly what will load and choose Open, Add to mine, or Dismiss. Private archive recordings are never included
- **Keyboard** - `1-8` audio, `M` mute, `L` next layout, `C` chat, `F` focus, `Esc` exit focus, `/` URL bar
- **Archives** (`/archives`, password protected) - add YouTube channels; when one goes live it is recorded automatically with yt-dlp, stored in a private DreamObjects bucket for 30 days, and listed here to play, download, or add to the viewer (never indexed; media only via short-lived signed links)

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build to dist/
npm run lint

# Backend (Archives) - needs yt-dlp + ffmpeg on PATH
cd backend && npm install && npm run build
ARCHIVE_PASSWORD_HASH=... SESSION_SECRET=... node dist/server.js   # :38411, Vite proxies /api
```

## Project structure

```
src/
├── components/
│   ├── Header/        # brand + URL bar with platform detection
│   ├── NowPlaying/    # toolbar, layouts (VideoGrid), tiles (VideoTile)
│   ├── Players/       # YouTube, Twitch, Kick, Custom players
│   └── Icons.tsx
├── contexts/VideoContext.tsx   # slots, audio, layout, persistence
├── services/urlParser.ts       # URL -> platform/id, labels, source links
├── services/scriptLoader.ts    # one-time YouTube/Twitch SDK loading
└── index.css                   # design tokens
backend/                         # Archives API + recorder (Express, yt-dlp, YouTube Data API)
├── src/services/recorder.ts     # poll -> record -> remux -> upload queue
├── src/services/youtube.ts      # resumable uploads, OAuth refresh
└── deploy/                      # run.sh + crontab for the VPS
```

## Deployment

See [DEPLOY_DREAMHOST.md](DEPLOY_DREAMHOST.md). TL;DR: `./DEPLOY.sh`.

## License

All rights reserved - TWill The Content Plug
