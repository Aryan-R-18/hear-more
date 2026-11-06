# Kinetic Lyrics

A kinetic typography lyrics visualizer that renders time-synced lyrics with WebGL kinetic text animations built from words, dots, lines, and particles, synchronized to playback.

---

## Tech Stack
- **Backend:** Rust, Axum, Tokio, SQLx with SQLite, reqwest, serde, tracing, tower-http (CORS)
- **Frontend:** React, Vite, TypeScript, PixiJS v8 (WebGL visuals), GSAP, Zustand (state management)
- **Extension:** Chrome Manifest V3, TypeScript
- **Lyrics Source:** [LRCLIB](https://lrclib.net/api) (no API key required)

---

## Monorepo Structure

```text
kinetic-lyrics/
├── backend/            # Rust Axum service (localhost:8080)
│   ├── src/{main.rs, routes.rs, lrclib.rs, cleaner.rs, cache.rs, timing.rs, models.rs}
│   └── migrations/
├── web/                # React + Vite kinetic typography visualizer
│   └── src/
│       ├── engine/     # Pure-function renderer, Director, ParticlePool, TextSampler
│       ├── scenes/     # DriftScene, DotMorphScene, LineSweepScene, PulseScene
│       ├── sync/       # Extrapolated PlaybackClock with user offset slider
│       ├── components/ # Visualizer, Controls, PlainLyrics
│       ├── store/      # Zustand player state store
│       └── lib/        # LRC parser & character/syllable word timing
├── extension/          # Chrome MV3 extension (content script, background service worker)
├── shared/             # Shared TypeScript types (Track, LyricLine, LyricWord, PlayerState)
└── README.md
```

---

## Getting Started

### Prerequisites
- Node.js (v18+) and npm
- Rust & Cargo (for backend in Phase 2)

### 1. Web Visualizer (Phase 1)
```bash
# Install dependencies across workspaces
npm install

# Start visualizer dev server
npm --workspace=web run dev
# or
npm run dev

# Run unit tests
npm test

# Build production bundle
npm run build
```

Open `http://localhost:5173` in your browser.

---

## Visualizer Controls & Keyboard Shortcuts

| Shortcut / Control | Action |
| --- | --- |
| `Space` | Play / Pause playback |
| `F` | Toggle Fullscreen |
| `[` / `]` | Nudge sync offset ±50ms |
| `S` | Cycle scenes (`Auto` → `Drift` → `Dot Morph` → `Line Sweep` → `Pulse`) |
| `←` / `→` | Seek backwards / forwards 5 seconds |
| **Offset Slider** | Fine-tune sync timing by ±2000 ms |
| **Scene Selector** | Override auto-director with a specific scene |
| **Theme Selector** | Choose palette: Cyberpunk Neon, Emerald Aurora, Sunset Glow, Minimal Mono |

---

## Engine Architecture (Pure Function of Time)

All visual scenes adhere to the critical deterministic rule:
$$\text{frame} = f(t_{\text{ms}}, \text{ctx})$$

- No animations depend on triggered or accumulated state across previous frames.
- Seeking, pausing, and scrubbing mid-song instantly compute and render the exact, deterministic frame.
- **Particle Pooling:** Dot Morph uses a dedicated `ParticlePool` capped at 3000 pooled items with offscreen canvas text pixel sampling, guaranteeing 60fps performance on mid-range laptops.
- **Scene Director:** Evaluates phrase lengths, chorus repetitions (fuzzy string similarity), and musical pauses to dynamically direct scenes per line.

---

## Legal Note & Terms

1. **Lyrics Copyright:** Lyrics are retrieved via [LRCLIB](https://lrclib.net) and remain the intellectual property and copyright of their respective authors, artists, and publishers. This project is provided for personal use and educational research only. Any commercial distribution or public hosting requires formal copyright and licensing clearances.
2. **Audio Integrity:** This application does not rip, scrape, download, or re-broadcast audio files or streams from any music streaming service. Playback position and metadata are read strictly for visual synchronization.
