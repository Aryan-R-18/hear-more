import { Application, Container, Graphics, Text } from 'pixi.js';
import { RenderContext, Scene } from '../engine/types';
import { SceneType } from '@kinetic-lyrics/shared';

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function hexToNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), 16) || 0xffffff;
}

export class DriftScene implements Scene {
  public readonly id: SceneType = 'drift';
  public readonly name = 'Drift';

  private container: Container = new Container();
  private wordTexts: Text[] = [];
  private highlightGfx: Graphics = new Graphics();
  private maxWords: number = 24;

  public init(_app: Application, parentContainer: Container): void {
    this.container.removeChildren();
    this.container.addChild(this.highlightGfx);

    this.wordTexts = [];
    for (let i = 0; i < this.maxWords; i++) {
      const text = new Text({
        text: '',
        style: {
          fontFamily: '"Plus Jakarta Sans", sans-serif',
          fontSize: 48,
          fontWeight: '700',
          fill: 0xffffff
        }
      });
      text.anchor.set(0.5, 0.5);
      text.visible = false;
      this.wordTexts.push(text);
      this.container.addChild(text);
    }

    parentContainer.addChild(this.container);
  }

  public getContainer(): Container {
    return this.container;
  }

  public render(tMs: number, ctx: RenderContext): void {
    this.highlightGfx.clear();

    const line = ctx.currentLine;
    if (!line || !line.words || line.words.length === 0) {
      for (const t of this.wordTexts) t.visible = false;
      return;
    }

    const { width, height, theme } = ctx;
    const words = line.words;
    const lineEndMs = line.end * 1000;

    // Line exit fade out during last 250ms
    let lineFade = 1.0;
    const remainingLineMs = lineEndMs - tMs;
    if (remainingLineMs < 250 && remainingLineMs > 0) {
      lineFade = clamp01(remainingLineMs / 250);
    } else if (remainingLineMs <= 0) {
      lineFade = 0;
    }

    // Measure total width to center the words
    const fontSize = Math.min(54, Math.max(26, width / (words.length * 1.8 + 8)));
    const spacing = fontSize * 0.45;

    // Calculate layout positions
    let totalLineWidth = 0;
    const wordWidths: number[] = [];

    for (let i = 0; i < words.length; i++) {
      const wText = this.wordTexts[i];
      if (!wText) break;
      wText.text = words[i].text;
      wText.style.fontSize = fontSize;
      const w = wText.width;
      wordWidths.push(w);
      totalLineWidth += w + (i < words.length - 1 ? spacing : 0);
    }

    // If total width exceeds screen width, support two-line wrap or auto-scale
    let scaleRatio = 1.0;
    if (totalLineWidth > width * 0.9) {
      scaleRatio = (width * 0.9) / totalLineWidth;
    }

    const startX = (width - totalLineWidth * scaleRatio) / 2;
    const centerY = height * 0.5;

    let currentX = startX;

    for (let i = 0; i < this.wordTexts.length; i++) {
      const textSprite = this.wordTexts[i];
      if (i >= words.length) {
        textSprite.visible = false;
        continue;
      }

      const word = words[i];
      const wWidth = wordWidths[i] * scaleRatio;
      const wordCenter = currentX + wWidth / 2;
      currentX += wWidth + spacing * scaleRatio;

      const wStartMs = word.start * 1000;
      const wEndMs = word.end * 1000;

      textSprite.visible = true;

      // Pure time-based calculation
      if (tMs < wStartMs) {
        // Approaching
        const approachProgress = clamp01((tMs - (wStartMs - 350)) / 350);
        const yOffset = (1 - approachProgress) * 25;
        const driftWave = Math.sin((tMs + i * 150) * 0.002) * 3;

        textSprite.x = wordCenter;
        textSprite.y = centerY + yOffset + driftWave;
        textSprite.alpha = approachProgress * 0.45 * lineFade;
        textSprite.scale.set(scaleRatio * 0.95);
        textSprite.style.fill = hexToNumber(theme.textColor);
      } else if (tMs >= wStartMs && tMs <= wEndMs) {
        // Active highlighted word
        const activeDuration = Math.max(1, wEndMs - wStartMs);
        const wordProgress = clamp01((tMs - wStartMs) / activeDuration);
        const popScale = 1.0 + Math.sin(wordProgress * Math.PI) * 0.18;
        const driftWave = Math.sin((tMs + i * 100) * 0.003) * 5;

        textSprite.x = wordCenter;
        textSprite.y = centerY - 6 + driftWave;
        textSprite.alpha = 1.0 * lineFade;
        textSprite.scale.set(scaleRatio * popScale);
        textSprite.style.fill = hexToNumber(theme.accentColor);

        // Draw glowing active word pill/underline
        const pillWidth = (wWidth + 24) * popScale;
        const pillHeight = fontSize * 1.35 * popScale;
        this.highlightGfx
          .roundRect(
            wordCenter - pillWidth / 2,
            centerY - pillHeight / 2 + driftWave - 4,
            pillWidth,
            pillHeight,
            12
          )
          .fill({ color: hexToNumber(theme.primaryColor), alpha: 0.18 * lineFade })
          .stroke({ color: hexToNumber(theme.accentColor), width: 2, alpha: 0.6 * lineFade });
      } else {
        // Played word
        const driftWave = Math.sin((tMs + i * 120) * 0.002) * 3;

        textSprite.x = wordCenter;
        textSprite.y = centerY + driftWave;
        textSprite.alpha = 0.85 * lineFade;
        textSprite.scale.set(scaleRatio);
        textSprite.style.fill = hexToNumber(theme.textColor);
      }
    }
  }

  public resize(_width: number, _height: number): void {}

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}

