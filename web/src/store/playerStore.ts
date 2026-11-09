import { create } from 'zustand';
import {
  LyricLine,
  SceneType,
  ThemeConfig,
  Track,
  PlayerState,
  ExtensionSettings,
  DEFAULT_EXTENSION_SETTINGS,
  LyricsResponse
} from '@kinetic-lyrics/shared';
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
  isLoadingLyrics: boolean;
  lyricsStatusMessage: string;

  // Extension mode & settings
  isExtensionMode: boolean;
  backendUrl: string;
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
  setBackendUrl: (url: string) => void;
  loadLrcText: (lrcContent: string, trackInfo?: Partial<Track>) => void;
  syncTick: (timeMs: number) => void;
  toggleFullscreen: () => void;
  syncPlayerState: (state: PlayerState | null) => Promise<void>;
  fetchLyrics: (title: string, artist: string, duration?: number) => Promise<void>;
  applySettings: (settings: Partial<ExtensionSettings>) => void;
  setIsExtensionMode: (isExt: boolean) => void;
}

const initialClock = new PlaybackClock(0);

// Helper to persist settings to chrome.storage.sync when available
function saveSyncSetting(update: Partial<ExtensionSettings>) {
  if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
    chrome.storage.sync.set(update, () => {
      // Ignore runtime errors
      if (chrome.runtime?.lastError) {
        // no-op
      }
    });
  }
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  clock: initialClock,
  isPlaying: false,
  currentTimeMs: 0,
  durationMs: 135000,
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
  isLoadingLyrics: false,
  lyricsStatusMessage: '',

  isExtensionMode: false,
  backendUrl: DEFAULT_EXTENSION_SETTINGS.backendUrl,
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
    saveSyncSetting({ offsetMs: clamped });
    set({ offsetMs: clamped, currentTimeMs: get().clock.getPositionMs() });
  },

  setRate: (rate: number) => {
    get().clock.setRate(rate);
    set({ playbackRate: rate });
  },

  setSceneOverride: (scene: SceneType) => {
    saveSyncSetting({ defaultScene: scene });
    set({ sceneOverride: scene });
  },

  setThemeKey: (themeKey: string) => {
    const theme = DEFAULT_THEMES[themeKey] || DEFAULT_THEMES.cyberpunk;
    saveSyncSetting({ themeKey });
    set({ themeKey, theme });
  },

  setBackendUrl: (url: string) => {
    saveSyncSetting({ backendUrl: url });
    set({ backendUrl: url });
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
      plainLyrics: '',
      isSynced: parsed.lines.length > 0,
      lyricsStatusMessage: parsed.lines.length > 0 ? '' : 'No synced lines found in LRC',
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
  },

  applySettings: (settings: Partial<ExtensionSettings>) => {
    const updates: Partial<PlayerStore> = {};
    if (settings.backendUrl) updates.backendUrl = settings.backendUrl;
    if (settings.offsetMs !== undefined) {
      get().clock.setOffset(settings.offsetMs);
      updates.offsetMs = settings.offsetMs;
    }
    if (settings.defaultScene) updates.sceneOverride = settings.defaultScene;
    if (settings.themeKey) {
      updates.themeKey = settings.themeKey;
      updates.theme = DEFAULT_THEMES[settings.themeKey] || DEFAULT_THEMES.cyberpunk;
    }
    set(updates);
  },

  setIsExtensionMode: (isExt: boolean) => {
    set({ isExtensionMode: isExt });
  },

  fetchLyrics: async (title: string, artist: string, duration?: number) => {
    set({ isLoadingLyrics: true, lyricsStatusMessage: `Searching lyrics for "${title}"...` });

    try {
      const backendUrl = get().backendUrl || 'http://localhost:8080';
      const params = new URLSearchParams({
        title,
        artist,
        ...(duration ? { duration: Math.round(duration).toString() } : {})
      });

      const response = await fetch(`${backendUrl}/api/lyrics?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Backend returned status ${response.status}`);
      }

      const data: LyricsResponse = await response.json();

      if (data.found && data.synced && data.lines && data.lines.length > 0) {
        set({
          lines: data.lines,
          plainLyrics: data.plainText || '',
          isSynced: true,
          isLoadingLyrics: false,
          lyricsStatusMessage: ''
        });
      } else if (data.plainText) {
        set({
          lines: [],
          plainLyrics: data.plainText,
          isSynced: false,
          isLoadingLyrics: false,
          lyricsStatusMessage: 'Only plain lyrics available'
        });
      } else {
        set({
          lines: [],
          plainLyrics: '',
          isSynced: false,
          isLoadingLyrics: false,
          lyricsStatusMessage: `No lyrics found for "${title}"`
        });
      }
    } catch (err: unknown) {
      console.warn('Failed to fetch lyrics from backend:', err);
      set({
        lines: [],
        plainLyrics: '',
        isSynced: false,
        isLoadingLyrics: false,
        lyricsStatusMessage: 'Cannot connect to backend (is it running on localhost:8080?)'
      });
    }
  },

  syncPlayerState: async (state: PlayerState | null) => {
    if (!state) {
      // No active track playing
      get().clock.pause();
      set({
        isPlaying: false,
        lyricsStatusMessage: 'No media playing. Play a track on YouTube, YouTube Music, or Spotify.'
      });
      return;
    }

    const prevTrack = get().track;
    const isNewTrack =
      prevTrack.title !== state.title ||
      (state.artist && prevTrack.artist !== state.artist);

    // Sync clock with latency compensation
    get().clock.syncState({
      positionMs: state.positionMs,
      playing: state.playing,
      rate: state.rate,
      timestamp: state.timestamp,
      duration: state.duration
    });

    const newDurationMs = state.duration > 0 ? state.duration * 1000 : get().durationMs;

    set({
      track: {
        title: state.title,
        artist: state.artist,
        duration: state.duration
      },
      durationMs: newDurationMs,
      isPlaying: state.playing,
      playbackRate: state.rate,
      currentTimeMs: get().clock.getPositionMs()
    });

    // If track changed, fetch lyrics from backend
    if (isNewTrack) {
      await get().fetchLyrics(state.title, state.artist, state.duration);
    }
  }
}));
