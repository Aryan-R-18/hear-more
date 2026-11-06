import { Application, Container, Graphics } from 'pixi.js';
import { LyricLine, LyricWord, SceneType, ThemeConfig } from '@kinetic-lyrics/shared';
import { DEFAULT_THEMES, RenderContext, Scene } from './types';
import { SceneDirector } from './director';
import { DriftScene } from '../scenes/DriftScene';
import { DotMorphScene } from '../scenes/DotMorphScene';
import { LineSweepScene } from '../scenes/LineSweepScene';
import { PulseScene } from '../scenes/PulseScene';

function hexToNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), 16) || 0x000000;
}

export class KineticEngine {
  private app: Application | null = null;
  private canvas: HTMLCanvasElement;
  private rootContainer: Container = new Container();
  private backgroundGfx: Graphics = new Graphics();
  private instrumentalGfx: Graphics = new Graphics();

  private scenes: Map<Exclude<SceneType, 'auto'>, Scene> = new Map();
  private director: SceneDirector = new SceneDirector();
  private lines: LyricLine[] = [];
  private theme: ThemeConfig = DEFAULT_THEMES.cyberpunk;
  private manualSceneOverride: SceneType = 'auto';

  private activeSceneId: Exclude<SceneType, 'auto'> = 'drift';
  private isInitialized: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    this.app = new Application();
    await this.app.init({
      canvas: this.canvas,
      resizeTo: window,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      backgroundColor: hexToNumber(this.theme.backgroundColor),
      antialias: true
    });

    this.app.stage.addChild(this.backgroundGfx);
    this.app.stage.addChild(this.rootContainer);
    this.app.stage.addChild(this.instrumentalGfx);

    // Register all scenes
    const drift = new DriftScene();
    const dotMorph = new DotMorphScene();
    const lineSweep = new LineSweepScene();
    const pulse = new PulseScene();

    drift.init(this.app, this.rootContainer);
    dotMorph.init(this.app, this.rootContainer);
    lineSweep.init(this.app, this.rootContainer);
    pulse.init(this.app, this.rootContainer);

    this.scenes.set('drift', drift);
    this.scenes.set('dotMorph', dotMorph);
    this.scenes.set('lineSweep', lineSweep);
    this.scenes.set('pulse', pulse);

    // Initial state: hide all scene containers until rendered
    for (const scene of this.scenes.values()) {
      scene.getContainer().visible = false;
      scene.getContainer().alpha = 0;
    }

    this.isInitialized = true;
    this.updateBackground();
  }

  public setLyrics(lines: LyricLine[]): void {
    this.lines = lines;
    this.director.analyzeTrack(lines);
  }

  public setSceneOverride(override: SceneType): void {
    this.manualSceneOverride = override;
  }

  public setTheme(theme: ThemeConfig): void {
    this.theme = theme;
    this.updateBackground();
  }

  private updateBackground(): void {
    if (!this.app) return;
    const { width, height } = this.app.screen;
    const bgNum = hexToNumber(this.theme.backgroundColor);
    const primNum = hexToNumber(this.theme.primaryColor);

    this.backgroundGfx.clear();
    // Solid background
    this.backgroundGfx.rect(0, 0, width, height).fill({ color: bgNum, alpha: 1.0 });

    // Subtle atmospheric ambient radial gradient simulation
    this.backgroundGfx.circle(width * 0.5, height * 0.5, Math.min(width, height) * 0.6)
      .fill({ color: primNum, alpha: 0.04 });
  }

  /**
   * Pure function of time rendering.
   * Seeking, pausing, and scrubbing instantly show the correct frame.
   */
  public renderFrame(tMs: number): void {
    if (!this.app || !this.isInitialized) return;

    const { width, height } = this.app.screen;
    const tSec = tMs / 1000;

    // Find current line based on tSec
    let currentLine: LyricLine | null = null;
    let currentLineIdx = -1;
    let nextLine: LyricLine | null = null;
    let prevLine: LyricLine | null = null;

    for (let i = 0; i < this.lines.length; i++) {
      const l = this.lines[i];
      if (tSec >= l.start && tSec < l.end) {
        currentLine = l;
        currentLineIdx = i;
        prevLine = i > 0 ? this.lines[i - 1] : null;
        nextLine = i + 1 < this.lines.length ? this.lines[i + 1] : null;
        break;
      } else if (tSec < l.start) {
        // We are before line i (in a gap or intro)
        nextLine = l;
        prevLine = i > 0 ? this.lines[i - 1] : null;
        break;
      }
    }

    // Clear instrumental graphics
    this.instrumentalGfx.clear();

    // If no line is active (intro, outro, or instrumental break)
    if (!currentLine || !currentLine.text.trim()) {
      for (const scene of this.scenes.values()) {
        scene.getContainer().visible = false;
        scene.getContainer().alpha = 0;
      }

      // Draw elegant pulsing instrumental indicator
      if (this.lines.length > 0) {
        const primNum = hexToNumber(this.theme.primaryColor);
        const dotsCount = 3;
        const dotSpacing = 28;
        const startX = width * 0.5 - ((dotsCount - 1) * dotSpacing) / 2;

        for (let d = 0; d < dotsCount; d++) {
          const dotWave = Math.sin(tMs * 0.004 + d * 0.8);
          const r = 3 + dotWave * 2;
          const a = 0.3 + dotWave * 0.3;
          this.instrumentalGfx
            .circle(startX + d * dotSpacing, height * 0.5, Math.max(1, r))
            .fill({ color: primNum, alpha: Math.max(0, a) });
        }
      }
      return;
    }

    // Determine active word
    let activeWord: LyricWord | null = null;
    let activeWordIdx = -1;
    for (let w = 0; w < currentLine.words.length; w++) {
      const word = currentLine.words[w];
      if (tSec >= word.start && tSec <= word.end) {
        activeWord = word;
        activeWordIdx = w;
        break;
      } else if (tSec < word.start && activeWord === null) {
        // Nearest upcoming word in this line
        activeWord = word;
        activeWordIdx = w;
        break;
      }
    }

    if (!activeWord && currentLine.words.length > 0) {
      activeWord = currentLine.words[currentLine.words.length - 1];
      activeWordIdx = currentLine.words.length - 1;
    }

    // Determine line progress
    const lineDuration = Math.max(0.1, currentLine.end - currentLine.start);
    const lineProgress = Math.max(0, Math.min(1, (tSec - currentLine.start) / lineDuration));

    // Choose scene for current line via SceneDirector
    const targetSceneId = this.director.getSceneForLine(currentLineIdx, this.manualSceneOverride);

    // Manage smooth transition between scenes
    const lineElapsedMs = (tSec - currentLine.start) * 1000;
    const transitionDurationMs = 250;
    const isTransitioningIn = lineElapsedMs < transitionDurationMs && currentLineIdx > 0;

    const targetScene = this.scenes.get(targetSceneId);

    const ctx: RenderContext = {
      tMs,
      currentLine,
      nextLine,
      prevLine,
      activeWord,
      activeWordIndex: activeWordIdx,
      lineProgress,
      width,
      height,
      theme: this.theme,
      app: this.app,
      stage: this.rootContainer
    };

    // Render active scene
    if (targetScene) {
      targetScene.render(tMs, ctx);
      const targetContainer = targetScene.getContainer();
      targetContainer.visible = true;

      if (isTransitioningIn) {
        const inAlpha = lineElapsedMs / transitionDurationMs;
        targetContainer.alpha = Math.max(0, Math.min(1, inAlpha));
      } else {
        targetContainer.alpha = 1.0;
      }
    }

    // Hide any inactive scenes
    for (const [id, scene] of this.scenes.entries()) {
      if (id !== targetSceneId) {
        scene.getContainer().visible = false;
        scene.getContainer().alpha = 0;
      }
    }

    this.activeSceneId = targetSceneId;
  }

  public getActiveSceneId(): Exclude<SceneType, 'auto'> {
    return this.activeSceneId;
  }

  public resize(): void {
    if (!this.app) return;
    this.app.renderer.resize(window.innerWidth, window.innerHeight);
    const { width, height } = this.app.screen;
    this.updateBackground();
    for (const scene of this.scenes.values()) {
      scene.resize(width, height);
    }
  }

  public destroy(): void {
    for (const scene of this.scenes.values()) {
      scene.destroy();
    }
    this.scenes.clear();
    if (this.app) {
      this.app.destroy(true, { children: true });
      this.app = null;
    }
    this.isInitialized = false;
  }
}

