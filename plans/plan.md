# TWill - The Content Plug
## Implementation Plan (Phase 1 - Without Recording)

### Overview
Build a Netflix-styled multi-stream video player that allows users to watch up to 4 simultaneous video streams from YouTube, Twitch, and Kick with smart audio controls and resizable viewing areas.

---

## Technology Stack

**Frontend:**
- React 18 with TypeScript
- React Split Pane library for resizable dividers
- CSS Modules for Netflix-inspired styling
- YouTube IFrame Player API
- Twitch Embed SDK
- Kick embedding (iframe-based)

**Key Features:**
- Netflix dark theme (background: #141414, accent: #E50914)
- 4-slot resizable video grid (2x2 layout)
- Smart audio control (only 1 slot plays audio at a time)
- Visual highlight for active audio slot
- URL parser supporting YouTube, Twitch, and Kick
- TWill logo in header

---

## Implementation Steps

### Phase 1: Project Setup
1. ✅ Create React app project structure with TypeScript
2. ✅ Set up project folder structure and configuration files
3. ✅ Design Netflix-inspired UI layout with dark theme and red accents

### Phase 2: Header & Input
4. ✅ Implement header component with TWill logo image
5. ✅ Create URL input search bar with Add button
6. ✅ Create URL parser service to detect platform and extract video/stream IDs

### Phase 3: Video Grid Layout
7. ✅ Build 4-slot grid layout for Now Playing section with full-width responsive design
8. ✅ Implement empty video slot placeholder component
9. ✅ Implement resizable split panes with vertical divider between left/right columns
10. ✅ Implement resizable split panes with horizontal divider between top/bottom rows

### Phase 4: Video Player Integration
11. ✅ Integrate YouTube Player API for YouTube video embedding
12. ✅ Integrate Twitch Player API for Twitch stream embedding
13. ✅ Research and integrate Kick stream embedding solution
14. ✅ Implement video slot component that renders correct player based on platform
15. ✅ Add play controls beneath each video slot

### Phase 5: Audio Control System
16. ✅ Create audio control toggle system with mute all button
17. ✅ Add per-slot audio selection functionality
18. ✅ Implement audio state management so only one slot plays audio at a time
19. ✅ Add visual highlight effect for currently active audio slot

### Phase 6: Polish & Testing
20. ✅ Style all components to match Netflix aesthetic with proper colors
21. ✅ Add error handling for invalid URLs
22. ✅ Add error handling for playback failures
23. ✅ Test all three platforms with sample URLs
24. ✅ Test audio switching between slots
25. ✅ Test resize functionality
26. ✅ Optimize performance for simultaneous 4-stream playback
27. ✅ Test cross-browser compatibility

---

## Component Architecture

```
App
├── Header
│   ├── Logo (twill.jpg)
│   └── URLInput (search bar + Add button)
└── NowPlaying
    ├── AudioControls (mute all + slot selector)
    └── VideoGrid (resizable split panes)
        ├── VideoSlot 1
        ├── VideoSlot 2
        ├── VideoSlot 3
        └── VideoSlot 4
```

---

## URL Parser Logic

**Supported Platforms:**

1. **YouTube:** 
   - `youtube.com/watch?v=VIDEO_ID`
   - `youtu.be/VIDEO_ID`
   - Extract: video ID

2. **Twitch:**
   - `twitch.tv/CHANNEL_NAME`
   - `twitch.tv/videos/VIDEO_ID`
   - Extract: channel name or video ID

3. **Kick:**
   - `kick.com/CHANNEL_NAME`
   - Extract: channel name

---

## Audio Control Rules

- Only ONE slot can have audio enabled at any time
- "Mute All" button silences all streams
- Clicking a slot activates its audio and mutes others
- Active audio slot has red border highlight
- Default: all slots muted on load

---

## Netflix Color Scheme

```css
--bg-primary: #141414
--bg-secondary: #221F1F
--accent-red: #E50914
--text-primary: #FFFFFF
--text-secondary: #B3B3B3
--border-color: #333333
```

---

## File Structure

```
twill/
├── src/
│   ├── components/
│   │   ├── Header/
│   │   │   ├── Header.tsx
│   │   │   ├── Header.module.css
│   │   │   └── URLInput.tsx
│   │   ├── NowPlaying/
│   │   │   ├── NowPlaying.tsx
│   │   │   ├── VideoGrid.tsx
│   │   │   ├── VideoSlot.tsx
│   │   │   └── AudioControls.tsx
│   │   └── Players/
│   │       ├── YouTubePlayer.tsx
│   │       ├── TwitchPlayer.tsx
│   │       └── KickPlayer.tsx
│   ├── services/
│   │   └── urlParser.ts
│   ├── contexts/
│   │   └── VideoContext.tsx
│   ├── hooks/
│   │   └── useAudioControl.ts
│   ├── styles/
│   │   └── theme.css
│   ├── assets/
│   │   └── twill.jpg
│   ├── App.tsx
│   └── index.tsx
├── public/
└── package.json
```

---

## State Management

**Video Slots State:**
```typescript
interface VideoSlot {
  id: number;
  platform: 'youtube' | 'twitch' | 'kick' | null;
  videoId: string | null;
  isActive: boolean;
}
```

**Audio Control State:**
```typescript
interface AudioState {
  activeSlot: number | null; // 0-3 or null for mute all
  muteAll: boolean;
}
```

---

## Technical Considerations

### Performance
- 4 simultaneous video streams = high resource usage
- Use lazy loading for player SDKs
- Implement proper cleanup on unmount
- Consider quality settings per stream

### Player Integration
- YouTube: Use IFrame Player API with proper event handling
- Twitch: Use official Embed SDK
- Kick: Use iframe embedding (check documentation for embed URLs)

### Browser Compatibility
- Test on Chrome, Firefox, Safari, Edge
- Ensure MediaStream API support for future recording feature
- Handle CORS and embedding restrictions

---

## Future Phase: Recording Feature

**Deferred to Phase 2:**
- MediaRecorder API integration
- S3 bucket connection for video storage
- Individual slot recording
- Combined 4-stream recording
- Upload progress indicators
- Backend API for upload handling

For recording implementation details, see [`twill-architecture.md`](twill-architecture.md)

---

## Getting Started

```bash
# Create React app with TypeScript
npx create-react-app twill --template typescript

# Install dependencies
npm install react-split-pane

# Start development server
npm start
```

---

## Testing Checklist

- [ ] YouTube video loads and plays in any slot
- [ ] Twitch stream loads and plays in any slot
- [ ] Kick stream loads and plays in any slot
- [ ] URL input accepts and parses all three platforms
- [ ] Only one slot plays audio at a time
- [ ] Mute all button works correctly
- [ ] Clicking slot activates its audio
- [ ] Active audio slot shows red highlight
- [ ] Vertical divider resizes left/right sections
- [ ] Horizontal divider resizes top/bottom sections
- [ ] All 4 slots can play simultaneously
- [ ] UI matches Netflix aesthetic
- [ ] Error handling for invalid URLs
- [ ] Error handling for failed playback
- [ ] Responsive to window resizing
