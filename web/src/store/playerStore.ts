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

interface QueryCandidate {
  title: string;
  artist: string;
}

function generateCandidates(rawTitle: string, rawArtist: string): QueryCandidate[] {
  const candidates: QueryCandidate[] = [];
  const seen = new Set<string>();

  const add = (t: string, a: string) => {
    const cleanT = t.replace(/\s+/g, ' ').trim();
    const cleanA = a.replace(/\s+/g, ' ').trim();
    if (!cleanT || cleanT.length < 2) return;
    const key = `${cleanT.toLowerCase()}___${cleanA.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      candidates.push({ title: cleanT, artist: cleanA });
    }
  };

  // Strip pipe subtitles: e.g. "Dusk Till Dawn – ZAYN & Sia | Two Hearts..." -> "Dusk Till Dawn – ZAYN & Sia"
  let cleanTitle = rawTitle;
  if (cleanTitle.includes('|')) {
    const parts = cleanTitle.split('|');
    if (parts[0].trim().length >= 3) {
      cleanTitle = parts[0].trim();
    }
  }

  // Strip bracketed noise tokens: (Official Video), (Lyrics), (Audio), [HD], etc.
  const noiseRegex = /[\(\[\{]\s*(?:official\s+(?:music\s+)?(?:video|mv|audio)|official\s+lyric\s+video|lyric\s+video|lyrics?|visualizer|audio|video|clip\s+officiel|mv|hd|hq|4k|remaster(?:ed)?|live|prod\.[^\)\]\}]+)[\)\]\}]/gi;
  cleanTitle = cleanTitle.replace(noiseRegex, ' ').replace(/\s+/g, ' ').trim();

  // Clean artist: strip "- Topic", "VEVO", "Official"
  let cleanArtist = rawArtist
    .replace(/\s*-\s*topic\s*$/i, '')
    .replace(/vevo$/i, '')
    .replace(/\bofficial\b/i, '')
    .trim();

  const isChannelLike = (name: string) => {
    return /\b(lyrics?|lyrical|haven|channel|records|music|clouds|vevo|nation|vibe|sound|trap|chill|tracks|tv|media|bass|edits|radio|fm|entertainment|production)\b/i.test(name);
  };

  const cleanFt = (s: string) =>
    s.replace(/\s*(?:feat|ft|featuring)\.?\s+.*$/i, '')
     .replace(/\s*&.*$/, '')
     .trim();

  // Check for separator dash: " - ", " – ", " — "
  const sepMatch = cleanTitle.match(/\s+[-–—]\s+/);
  if (sepMatch && sepMatch.index !== undefined) {
    const part1 = cleanTitle.substring(0, sepMatch.index).trim();
    const part2 = cleanTitle.substring(sepMatch.index + sepMatch[0].length).trim();

    if (isChannelLike(cleanArtist) || !cleanArtist) {
      // Channel name is generic noise:
      // Try (part1 as title, part2 as artist) e.g. "Dusk Till Dawn" by "ZAYN"
      add(part1, cleanFt(part2));
      add(part1, part2);
      // Try (part2 as title, part1 as artist) e.g. "Song" by "Artist"
      add(part2, cleanFt(part1));
      add(part2, part1);
      // Try title without artist
      add(part1, '');
    } else {
      // Channel might be valid artist or video title is "Artist - Song"
      add(part2, cleanFt(part1));
      add(part1, cleanFt(part2));
      add(cleanTitle, cleanArtist);
    }
  } else {
    // No separator in title
    if (isChannelLike(cleanArtist)) {
      add(cleanTitle, '');
    } else {
      add(cleanTitle, cleanArtist);
    }
  }

  // Always include raw fallback as last resort
  add(rawTitle, rawArtist);

  return candidates;
}

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
      const candidates = generateCandidates(title, artist);

      let bestMatch: LyricsResponse | null = null;

      for (const candidate of candidates) {
        try {
          const params = new URLSearchParams({
            title: candidate.title,
            ...(candidate.artist ? { artist: candidate.artist } : {}),
            ...(duration ? { duration: Math.round(duration).toString() } : {})
          });

          const response = await fetch(`${backendUrl}/api/lyrics?${params.toString()}`);
          if (!response.ok) continue;

          const data: LyricsResponse = await response.json();
          if (data.found && data.synced && data.lines && data.lines.length > 0) {
            bestMatch = data;
            break; // Ideal synced match found!
          } else if (data.found && data.plainText && !bestMatch) {
            bestMatch = data;
          }
        } catch {
          // Continue to next candidate
        }
      }

      if (bestMatch && bestMatch.found && bestMatch.synced && bestMatch.lines && bestMatch.lines.length > 0) {
        set({
          lines: bestMatch.lines,
          plainLyrics: bestMatch.plainText || '',
          isSynced: true,
          isLoadingLyrics: false,
          lyricsStatusMessage: ''
        });
      } else if (bestMatch && bestMatch.plainText) {
        set({
          lines: [],
          plainLyrics: bestMatch.plainText,
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
