import { Application, Container } from 'pixi.js';
import { LyricLine, LyricWord, SceneType, ThemeConfig } from '@kinetic-lyrics/shared';

export interface RenderContext {
  tMs: number;
  currentLine: LyricLine | null;
  nextLine: LyricLine | null;
  prevLine: LyricLine | null;
  activeWord: LyricWord | null;
  activeWordIndex: number;
  lineProgress: number; // 0.0 to 1.0
  width: number;
  height: number;
  theme: ThemeConfig;
  app: Application;
  stage: Container;
}

export interface Scene {
  readonly id: SceneType;
  readonly name: string;
  init(app: Application, container: Container): Promise<void> | void;
  render(tMs: number, ctx: RenderContext): void;
  resize(width: number, height: number): void;
  destroy(): void;
  getContainer(): Container;
}

export const DEFAULT_THEMES: Record<string, ThemeConfig> = {
  cyberpunk: {
    name: 'Cyberpunk Neon',
    primaryColor: '#00f3ff',
    secondaryColor: '#ff0077',
    accentColor: '#ffe600',
    backgroundColor: '#0a0a14',
    textColor: '#ffffff'
  },
  emerald: {
    name: 'Emerald Aurora',
    primaryColor: '#10b981',
    secondaryColor: '#34d399',
    accentColor: '#a7f3d0',
    backgroundColor: '#031a14',
    textColor: '#f0fdf4'
  },
  sunset: {
    name: 'Sunset Glow',
    primaryColor: '#f97316',
    secondaryColor: '#ec4899',
    accentColor: '#fbbf24',
    backgroundColor: '#18081f',
    textColor: '#fff7ed'
  },
  monochrome: {
    name: 'Minimal Mono',
    primaryColor: '#ffffff',
    secondaryColor: '#a1a1aa',
    accentColor: '#38bdf8',
    backgroundColor: '#09090b',
    textColor: '#f4f4f5'
  }
};

