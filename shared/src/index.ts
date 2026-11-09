export interface LyricWord {
  text: string;
  start: number; // in seconds (e.g. 12.3)
  end: number;   // in seconds (e.g. 12.8)
}

export interface LyricLine {
  start: number; // in seconds
  end: number;   // in seconds
  text: string;
  words: LyricWord[];
}

export interface Track {
  title: string;
  artist: string;
  duration?: number; // in seconds
  album?: string;
}

export interface PlayerState {
  title: string;
  artist: string;
  duration: number; // in seconds
  positionMs: number;
  playing: boolean;
  rate: number;
  timestamp: number; // wall-clock ms when state was sampled
}

export interface LyricsResponse {
  found: boolean;
  source: string;
  synced: boolean;
  lines: LyricLine[];
  plainText?: string;
}

export type SceneType = 'drift' | 'dotMorph' | 'lineSweep' | 'pulse' | 'auto';

export interface ThemeConfig {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
}

export interface ExtensionSettings {
  backendUrl: string;
  offsetMs: number;
  defaultScene: SceneType;
  themeKey: string;
}

export const DEFAULT_EXTENSION_SETTINGS: ExtensionSettings = {
  backendUrl: 'http://localhost:8080',
  offsetMs: 0,
  defaultScene: 'auto',
  themeKey: 'cyberpunk',
};

export type ExtensionMessage =
  | { type: 'PLAYER_STATE_UPDATE'; state: PlayerState | null; tabId?: number }
  | { type: 'GET_PLAYER_STATE' }
  | { type: 'PLAYER_STATE_RESPONSE'; state: PlayerState | null }
  | { type: 'GET_SETTINGS' }
  | { type: 'SAVE_SETTINGS'; settings: Partial<ExtensionSettings> };


