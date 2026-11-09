# Kinetic Lyrics

A kinetic typography lyrics visualizer that detects playback on YouTube, YouTube Music, and Spotify Web, fetches time-synced lyrics from LRCLIB, and renders them as WebGL kinetic text animations built from words, dots, lines, and particles, synchronized to playback.

---

## Tech Stack
- **Backend:** Rust, Axum, Tokio, SQLx with SQLite, reqwest, serde, tracing, tower-http (CORS)
- **Frontend:** React, Vite, TypeScript, PixiJS v8 (WebGL visuals), GSAP, Zustand (state management)
- **Extension:** Chrome Manifest V3, TypeScript, Vite build pipeline
- **Lyrics Source:** [LRCLIB](https://lrclib.net/api) (no API key required)

---

## Monorepo Structure

```text
kinetic-lyrics/
├── backend/            # Rust Axum service (localhost:8080)
│   ├── src/{main.rs, routes.rs, lrclib.rs, cleaner.rs, cache.rs, timing.rs, models.rs}
│   ├── migrations/     # SQLite cache migrations
│   └── Cargo.toml
├── web/                # React + Vite kinetic typography visualizer
│   └── src/
│       ├── engine/     # Pure-function renderer, Director, ParticlePool, TextSampler
│       ├── scenes/     # DriftScene, DotMorphScene, LineSweepScene, PulseScene
│       ├── sync/       # Extrapolated PlaybackClock with user offset slider
│       ├── components/ # Visualizer, Controls, PlainLyrics
│       ├── store/      # Zustand player state store (synced with background & backend)
│       └── lib/        # LRC parser & character/syllable word timing
├── extension/          # Chrome MV3 extension
│   ├── src/
│   │   ├── content.ts   # Media detector for YouTube, YouTube Music, and Spotify
│   │   ├── background.ts # Service worker, multi-tab arbitration, sidepanel relay
│   │   └── viewer/     # Extension viewer entry point reusing web app
│   ├── icons/          # Extension icons (16, 48, 128)
│   ├── manifest.json   # Chrome MV3 manifest
│   ├── build.js        # Multi-entry Vite build pipeline
│   ├── viewer.html     # Full tab viewer page
│   └── sidepanel.html  # Chrome Side Panel page
├── shared/             # Shared TypeScript types (Track, LyricLine, LyricWord, PlayerState)
└── README.md
```

---

## Getting Started

### Prerequisites
- Node.js (v18+) and npm
- Rust & Cargo (1.75+)

---

### 1. Start the Rust Backend
The backend provides time-synced lyrics fetching with title cleaning and SQLite caching on `localhost:8080`:

```bash
cd backend
cargo run
```
*Health check:* `http://localhost:8080/api/health`  
*Lyrics endpoint:* `http://localhost:8080/api/lyrics?title=Blinding%20Lights&artist=The%20Weeknd&duration=200`

---

### 2. Standalone Web Visualizer (Phase 1)
To run the visualizer in standalone demo mode with bundled sample songs:

```bash
# Install dependencies across workspaces
npm install

# Start visualizer dev server
npm run dev

# Run unit tests
npm test
```
Open `http://localhost:5173` in your browser.

---

### 3. Load the Chrome Extension (Phase 3)

#### Step 1: Build the Extension
```bash
npm run build
# or specifically:
npm --workspace=extension run build
```
The unpacked extension will be compiled into `extension/dist/`.

#### Step 2: Load into Google Chrome
1. Open Google Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** in the top-right corner.
3. Click **Load unpacked** in the top-left corner.
4. Select the `extension/dist` folder inside this project.

#### Step 3: Using the Extension
1. Open any of the supported streaming services:
   - [YouTube](https://www.youtube.com)
   - [YouTube Music](https://music.youtube.com)
   - [Spotify Web](https://open.spotify.com)
2. Play any song.
3. Click the **Kinetic Lyrics** extension icon in your browser toolbar:
   - The visualizer opens automatically in the **Side Panel** or as a **Full Tab Viewer** (`viewer.html`).
   - Play, pause, seek, and track switches on YouTube / Spotify are mirrored in real time with <100ms sync accuracy!

---

## Visualizer Controls & Keyboard Shortcuts

| Shortcut / Control | Action |
| --- | --- |
| `Space` | Play / Pause playback |
| `F` | Toggle Fullscreen |
| `[` / `]` | Nudge sync offset ±50ms |
| `S` | Cycle scenes (`Auto` → `Drift` → `Dot Morph` → `Line Sweep` → `Pulse`) |
| `←` / `→` | Seek backwards / forwards 5 seconds |
| **Offset Slider** | Fine-tune sync timing by ±2000 ms (persisted in `chrome.storage.sync`) |
| **Scene Selector** | Override auto-director with a specific scene |
| **Theme Selector** | Choose palette: Cyberpunk Neon, Emerald Aurora, Sunset Glow, Minimal Mono |

---

## Engine Architecture (Pure Function of Time)

All visual scenes adhere to the deterministic rule:
$$\text{frame} = f(t_{\text{ms}}, \text{ctx})$$

- No animations depend on triggered or accumulated state across previous frames.
- Seeking, pausing, and scrubbing mid-song instantly compute and render the exact, deterministic frame.
- **Particle Pooling:** Dot Morph uses a dedicated `ParticlePool` capped at 3000 pooled items with offscreen canvas text pixel sampling, guaranteeing 60fps performance on mid-range laptops.
- **Scene Director:** Evaluates phrase lengths, chorus repetitions (fuzzy string similarity), and musical pauses to dynamically direct scenes per line.

---

## Legal Note & Terms

1. **Lyrics Copyright:** Lyrics are retrieved via [LRCLIB](https://lrclib.net) and remain the intellectual property and copyright of their respective authors, artists, and publishers. This project is provided for personal use and educational research only. Any commercial distribution or public hosting requires formal copyright and licensing clearances.
2. **Audio Integrity:** This application does not rip, scrape, download, or re-broadcast audio files or streams from any music streaming service. Playback position and metadata are read strictly for visual synchronization.
