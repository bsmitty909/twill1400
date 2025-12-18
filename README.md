# TWill - The Content Plug

A Netflix-inspired multi-stream video player that allows you to watch up to 4 simultaneous video streams from YouTube, Twitch, and Kick with smart audio control and resizable viewing areas.

![TWill Logo](public/twill.jpg)

## 🎯 Features

### Multi-Platform Support
- **YouTube** - Play any YouTube video
- **Twitch** - Watch live streams and VODs
- **Kick** - Stream from Kick channels

### 4-Slot Video Grid
- Watch up to 4 streams simultaneously
- Full browser-width display
- Resizable video panes with drag-and-drop dividers
- 2x2 grid layout

### Smart Audio Control
- Only ONE slot plays audio at a time
- Click any video to activate its audio
- "Mute All" button to silence all streams
- Visual highlight (red border glow) on active audio slot
- Audio control buttons for quick slot selection

### Netflix-Inspired UI
- Dark theme (#141414 background)
- Netflix red accents (#E50914)
- Clean, modern interface
- TWill branding

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173/`

### Build for Production

```bash
npm run build
```

## 📖 How to Use

### Adding Videos

1. Paste a video URL in the search bar at the top
2. Click the **ADD** button
3. The video will load in the first available slot

**Supported URL formats:**
- YouTube: `https://www.youtube.com/watch?v=VIDEO_ID` or `https://youtu.be/VIDEO_ID`
- Twitch: `https://www.twitch.tv/CHANNEL_NAME` or `https://www.twitch.tv/videos/VIDEO_ID`
- Kick: `https://kick.com/CHANNEL_NAME`

### Controlling Audio

**Option 1: Mute All Button**
- Click "🔇 UNMUTE ALL" / "🔊 MUTE ALL" to toggle all audio

**Option 2: Slot Buttons**
- Click buttons 1-4 to activate audio for that specific slot
- Only one slot can have audio active at a time

**Option 3: Click Video**
- Click directly on any playing video to activate its audio
- Click again to mute

### Resizing Video Panes

- Drag the **vertical divider** (between left and right columns) to adjust width
- Drag the **horizontal dividers** (between top and bottom rows) to adjust height
- Customize your viewing layout to your preference

### Clearing Slots

- Click the **✕** button on any video to remove it and free up that slot

## 🏗️ Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **React Split** for resizable panes
- **YouTube IFrame Player API**
- **Twitch Embed SDK**
- **Kick** iframe embedding

## 📁 Project Structure

```
src/
├── components/
│   ├── Header/           # Logo and URL input
│   ├── NowPlaying/       # 4-slot grid and audio controls
│   ├── Players/          # YouTube, Twitch, Kick players
│   └── ErrorBoundary.tsx # Error handling
├── contexts/
│   └── VideoContext.tsx  # Global state management
├── services/
│   └── urlParser.ts      # URL parsing and validation
├── types/
│   └── index.ts          # TypeScript type definitions
└── App.tsx               # Main application component
```

## 🎨 Customization

### Color Scheme (CSS Variables)
```css
--bg-primary: #141414      /* Netflix dark background */
--bg-secondary: #221F1F    /* Secondary background */
--accent-red: #E50914      /* Netflix red */
--text-primary: #FFFFFF    /* White text */
--text-secondary: #B3B3B3  /* Gray text */
--border-color: #333333    /* Border/divider color */
--hover-red: #F40612       /* Hover red */
```

## 🔮 Future Enhancements

### Phase 2: Recording Feature
- MediaRecorder API integration
- Record individual slots or all 4 combined
- Upload recordings to Backblaze B2 storage
- Progress indicators and download options

### Planned Features
- Playback controls (play/pause/volume sliders)
- Save favorite layouts
- Keyboard shortcuts
- Picture-in-picture mode
- Stream health monitoring
- Chat integration for live streams
- Video quality selection
- Viewing history

## ⚙️ Browser Compatibility

- **Chrome/Edge**: Full support
- **Firefox**: Full support
- **Safari**: Full support (macOS 12+)

Note: Video playback depends on platform player APIs and their browser support.

## 🤝 Contributing

This project was built with React, TypeScript, and modern web technologies. Feel free to fork and enhance!

## 📝 License

All rights reserved - TWill The Content Plug

---

**Enjoy watching your favorite streams all in one place! 🎬**
