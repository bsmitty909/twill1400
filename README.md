# TWill - The Content Plug

Multi-stream viewer: watch up to 8 YouTube, Twitch, Kick, or custom iframe streams side by side, with one-click audio switching and resizable, rearrangeable tiles.

Live: https://twill1400.com

## Features

- **8 slots** - YouTube videos/lives/shorts, Twitch channels and VODs (`/videos/<id>`), Kick channels, and any other URL or pasted `<iframe>` embed code
- **Layouts** - *Stage* (2 resizable main tiles + two 3-tile rails, divider sizes remembered) and *Grid* (auto-fit for the number of streams); phones/tablets (< 900px) get a stacked 16:9 list
- **Audio** - exactly one stream is audible; pick it with a tile's speaker icon or the 1-8 chips in the toolbar; "Mute all" remembers the last source
- **Arrange** - drag a tile by its grip onto another slot to swap them
- **Session persistence** - streams and layout survive a reload (localStorage)
- **Keyboard** - `/` focuses the URL bar, Enter adds

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build to dist/
npm run lint
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
backend/                         # optional yt-dlp -> S3 download service
```

## Deployment

See [DEPLOY_DREAMHOST.md](DEPLOY_DREAMHOST.md). TL;DR: `./DEPLOY.sh`.

## License

All rights reserved - TWill The Content Plug
