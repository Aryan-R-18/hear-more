import { create } from 'zustand';
import { LyricLine, SceneType, ThemeConfig, Track } from '@kinetic-lyrics/shared';
import { PlaybackClock } from '../sync/clock';
import { parseLrc } from '../lib/lrc';
import { DEFAULT_THEMES } from '../engine/types';

interface PlayerStore {
  // Playback state
  clock: PlaybackClock;
  isPlaying: boolean;
  currentTimeMs: number;
  durationMs: number;
  playbackRate: number;
  offsetMs: number;

  // Track & Lyrics
  track: Track;
  lines: LyricLine[];
  plainLyrics: string;
  isSynced: boolean;

  // Settings & Visuals
  themeKey: string;
  theme: ThemeConfig;
  sceneOverride: SceneType;
  isFullscreen: boolean;

  // Actions
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (positionMs: number) => void;
  setOffset: (offsetMs: number) => void;
  setRate: (rate: number) => void;
  setSceneOverride: (scene: SceneType) => void;
  setThemeKey: (themeKey: string) => void;
  loadLrcText: (lrcContent: string, trackInfo?: Partial<Track>) => void;
  syncTick: (timeMs: number) => void;
  toggleFullscreen: () => void;
}

const initialClock = new PlaybackClock(0);

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  clock: initialClock,
  isPlaying: false,
  currentTimeMs: 0,
  durationMs: 135000, // 2:15 default duration
  playbackRate: 1.0,
  offsetMs: 0,

  track: {
    title: 'Midnight City Drive',
    artist: 'Synthwave Collective',
    duration: 135
  },
  lines: [],
  plainLyrics: '',
  isSynced: true,

  themeKey: 'cyberpunk',
  theme: DEFAULT_THEMES.cyberpunk,
  sceneOverride: 'auto',
  isFullscreen: false,

  play: () => {
    get().clock.play();
    set({ isPlaying: true });
  },

  pause: () => {
    get().clock.pause();
    set({ isPlaying: false, currentTimeMs: get().clock.getPositionMs() });
  },

  togglePlay: () => {
    const isNowPlaying = get().clock.togglePlay();
    set({ isPlaying: isNowPlaying, currentTimeMs: get().clock.getPositionMs() });
  },

  seek: (positionMs: number) => {
    get().clock.seek(positionMs);
    set({ currentTimeMs: get().clock.getPositionMs() });
  },

  setOffset: (offsetMs: number) => {
    const clamped = Math.max(-2000, Math.min(2000, offsetMs));
    get().clock.setOffset(clamped);
    set({ offsetMs: clamped, currentTimeMs: get().clock.getPositionMs() });
  },

  setRate: (rate: number) => {
    get().clock.setRate(rate);
    set({ playbackRate: rate });
  },

  setSceneOverride: (scene: SceneType) => {
    set({ sceneOverride: scene });
  },

  setThemeKey: (themeKey: string) => {
    const theme = DEFAULT_THEMES[themeKey] || DEFAULT_THEMES.cyberpunk;
    set({ themeKey, theme });
  },

  loadLrcText: (lrcContent: string, trackInfo?: Partial<Track>) => {
    const parsed = parseLrc(lrcContent);
    const lastLine = parsed.lines[parsed.lines.length - 1];
    const duration = trackInfo?.duration || (lastLine ? lastLine.end + 2 : 120);

    get().clock.setDuration(duration);
    get().clock.seek(0);

    const title = trackInfo?.title || parsed.metadata.title || 'Unknown Track';
    const artist = trackInfo?.artist || parsed.metadata.artist || 'Unknown Artist';

    set({
      track: { title, artist, duration },
      lines: parsed.lines,
      isSynced: parsed.lines.length > 0,
      durationMs: duration * 1000,
      currentTimeMs: 0,
      isPlaying: false
    });
  },

  syncTick: (timeMs: number) => {
    set({ currentTimeMs: timeMs });
  },

  toggleFullscreen: () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        set({ isFullscreen: true });
      }).catch(() => {});
    } else {
      document.exitFullscreen().then(() => {
        set({ isFullscreen: false });
      }).catch(() => {});
    }
  }
}));

