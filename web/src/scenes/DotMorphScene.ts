import { Application, Container, Graphics } from 'pixi.js';
import { RenderContext, Scene } from '../engine/types';
import { ParticlePool } from '../engine/particlePool';
import { SampledPoint, TextSampler } from '../engine/textSampler';
import { SceneType } from '@kinetic-lyrics/shared';

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function hexToNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), 16) || 0xffffff;
}

// Deterministic pseudo-random number for stable scrubbing
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 999.123 + 45.678) * 10000;
  return x - Math.floor(x);
}

export class DotMorphScene implements Scene {
  public readonly id: SceneType = 'dotMorph';
  public readonly name = 'Dot Morph';

  private container: Container = new Container();
  private graphics: Graphics = new Graphics();
  private pool: ParticlePool = new ParticlePool(3000); // Capped at 3000
  private textSampler: TextSampler = new TextSampler();

  public init(_app: Application, parentContainer: Container): void {
    this.container.removeChildren();
    this.container.addChild(this.graphics);
    parentContainer.addChild(this.container);
  }

  public getContainer(): Container {
    return this.container;
  }

  public render(tMs: number, ctx: RenderContext): void {
    this.graphics.clear();
    this.pool.reset();

    const line = ctx.currentLine;
    if (!line || !line.words || line.words.length === 0) {
      return;
    }

    const { width, height, theme } = ctx;
    const activeWord = ctx.activeWord || line.words[0];
    const words = line.words;
    const activeIdx = ctx.activeWordIndex >= 0 ? ctx.activeWordIndex : 0;

    const primaryColorNum = hexToNumber(theme.primaryColor);
    const accentColorNum = hexToNumber(theme.accentColor);
    const textColorNum = hexToNumber(theme.textColor);

    // Render the active word prominently with Dot Morph
    const textToRender = activeWord.text;
    const fontSize = Math.min(84, Math.max(42, width / (textToRender.length * 0.9 + 4)));
    const sampleResult = this.textSampler.sampleText(textToRender, fontSize, '"Syne", sans-serif', 2200);
    const points: SampledPoint[] = sampleResult.points;

    const centerX = width * 0.5;
    const centerY = height * 0.5;

    const wStartMs = activeWord.start * 1000;
    const wEndMs = activeWord.end * 1000;
    const durationMs = Math.max(1, wEndMs - wStartMs);

    const morphInMs = Math.min(220, durationMs * 0.35);
    const morphOutMs = Math.min(220, durationMs * 0.3);

    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      const particle = this.pool.acquire();
      if (!particle) break; // Reached pool cap (3000)

      const seed1 = pseudoRandom(i + activeIdx * 1000);
      const seed2 = pseudoRandom(i * 3 + activeIdx * 2000);
      const seed3 = pseudoRandom(i * 7 + activeIdx * 3000);

      const scatterAngle = seed1 * Math.PI * 2;
      const scatterDist = 140 + seed2 * 260;

      const originX = centerX + pt.x + Math.cos(scatterAngle) * scatterDist;
      const originY = centerY + pt.y + Math.sin(scatterAngle) * scatterDist;

      const exitAngle = scatterAngle + (seed3 - 0.5) * 1.5;
      const exitDist = 180 + seed3 * 300;
      const exitX = centerX + pt.x + Math.cos(exitAngle) * exitDist;
      const exitY = centerY + pt.y + Math.sin(exitAngle) * exitDist;

      const targetX = centerX + pt.x;
      const targetY = centerY + pt.y;

      let curX = targetX;
      let curY = targetY;
      let alpha = 1.0;
      let radius = 2.4;

      if (tMs < wStartMs) {
        // Approaching morph-in
        const approachWindow = 250;
        const p = clamp01((tMs - (wStartMs - approachWindow)) / approachWindow);
        // Ease out quad
        const eased = 1 - (1 - p) * (1 - p);
        curX = originX + (targetX - originX) * eased;
        curY = originY + (targetY - originY) * eased;
        alpha = p * 0.8;
      } else if (tMs <= wEndMs) {
        const elapsed = tMs - wStartMs;
        if (elapsed < morphInMs) {
          // Settling in
          const p = clamp01(elapsed / morphInMs);
          const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
          curX = originX + (targetX - originX) * eased;
          curY = originY + (targetY - originY) * eased;
          alpha = 0.8 + p * 0.2;
        } else {
          // Active hold with subtle fluid particle breathing
          const wave = Math.sin(tMs * 0.0035 + i * 0.15) * 1.8;
          curX = targetX + Math.cos(i) * wave;
          curY = targetY + Math.sin(i) * wave;
          alpha = 1.0;
          radius = 2.6;
        }
      } else {
        // Scattering on exit
        const exitElapsed = tMs - wEndMs;
        const p = clamp01(exitElapsed / morphOutMs);
        const eased = p * p; // easeInQuad
        curX = targetX + (exitX - targetX) * eased;
        curY = targetY + (exitY - targetY) * eased;
        alpha = Math.max(0, 1.0 - p);
        radius = Math.max(0.5, 2.4 * (1 - p * 0.5));
      }

      if (alpha > 0.01) {
        const color = i % 4 === 0 ? accentColorNum : primaryColorNum;
        this.graphics
          .circle(curX, curY, radius)
          .fill({ color, alpha });
      }
    }

    // Also draw preceding and following words faintly in context above and below
    const contextWordsAbove = words.slice(0, activeIdx).map(w => w.text).join(' ');
    const contextWordsBelow = words.slice(activeIdx + 1).map(w => w.text).join(' ');

    if (contextWordsAbove) {
      const topSampler = this.textSampler.sampleText(contextWordsAbove, 24, '"Plus Jakarta Sans", sans-serif', 350);
      for (const pt of topSampler.points) {
        const p = this.pool.acquire();
        if (!p) break;
        this.graphics
          .circle(centerX + pt.x, centerY - fontSize * 1.1 + pt.y, 1.4)
          .fill({ color: textColorNum, alpha: 0.35 });
      }
    }

    if (contextWordsBelow) {
      const bottomSampler = this.textSampler.sampleText(contextWordsBelow, 24, '"Plus Jakarta Sans", sans-serif', 350);
      for (const pt of bottomSampler.points) {
        const p = this.pool.acquire();
        if (!p) break;
        this.graphics
          .circle(centerX + pt.x, centerY + fontSize * 1.1 + pt.y, 1.4)
          .fill({ color: textColorNum, alpha: 0.35 });
      }
    }
  }

  public resize(_width: number, _height: number): void {}

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}

