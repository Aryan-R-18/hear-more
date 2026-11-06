import { Application, Container, Graphics, Text } from 'pixi.js';
import { RenderContext, Scene } from '../engine/types';
import { SceneType } from '@kinetic-lyrics/shared';

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function hexToNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), 16) || 0xffffff;
}

export class LineSweepScene implements Scene {
  public readonly id: SceneType = 'lineSweep';
  public readonly name = 'Line Sweep';

  private container: Container = new Container();
  private sweepGfx: Graphics = new Graphics();
  private wordTexts: Text[] = [];
  private maxWords: number = 24;

  public init(_app: Application, parentContainer: Container): void {
    this.container.removeChildren();
    this.container.addChild(this.sweepGfx);

    this.wordTexts = [];
    for (let i = 0; i < this.maxWords; i++) {
      const text = new Text({
        text: '',
        style: {
          fontFamily: '"Syne", "Plus Jakarta Sans", sans-serif',
          fontSize: 48,
          fontWeight: '800',
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
    this.sweepGfx.clear();

    const line = ctx.currentLine;
    if (!line || !line.words || line.words.length === 0) {
      for (const t of this.wordTexts) t.visible = false;
      return;
    }

    const { width, height, theme } = ctx;
    const words = line.words;
    const lineStartMs = line.start * 1000;
    const lineEndMs = line.end * 1000;
    const lineDuration = Math.max(1, lineEndMs - lineStartMs);

    // Line exit fade
    let lineFade = 1.0;
    const remainingLineMs = lineEndMs - tMs;
    if (remainingLineMs < 200 && remainingLineMs > 0) {
      lineFade = clamp01(remainingLineMs / 200);
    } else if (remainingLineMs <= 0) {
      lineFade = 0;
    }

    // Typography sizing
    const fontSize = Math.min(56, Math.max(28, width / (words.length * 1.6 + 6)));
    const spacing = fontSize * 0.45;

    let totalWidth = 0;
    const wordWidths: number[] = [];
    for (let i = 0; i < words.length; i++) {
      const tSprite = this.wordTexts[i];
      if (!tSprite) break;
      tSprite.text = words[i].text;
      tSprite.style.fontSize = fontSize;
      const w = tSprite.width;
      wordWidths.push(w);
      totalWidth += w + (i < words.length - 1 ? spacing : 0);
    }

    let scaleRatio = 1.0;
    if (totalWidth > width * 0.88) {
      scaleRatio = (width * 0.88) / totalWidth;
    }

    const startX = (width - totalWidth * scaleRatio) / 2;
    const endX = startX + totalWidth * scaleRatio;
    const centerY = height * 0.48;
    const sweepLineY = centerY + (fontSize * 0.75 * scaleRatio);

    // Pure time-based sweep progress (0.0 at line start, 1.0 at line end)
    const sweepProgress = clamp01((tMs - lineStartMs) / lineDuration);
    const sweepCurrentX = startX + (endX - startX) * sweepProgress;

    const primaryColorNum = hexToNumber(theme.primaryColor);
    const accentColorNum = hexToNumber(theme.accentColor);
    const secColorNum = hexToNumber(theme.secondaryColor);
    const textColorNum = hexToNumber(theme.textColor);

    // 1. Draw sweep track (ahead of beam)
    this.sweepGfx
      .moveTo(startX - 20, sweepLineY)
      .lineTo(endX + 20, sweepLineY)
      .stroke({ color: secColorNum, width: 2, alpha: 0.25 * lineFade });

    // 2. Draw active beam (behind current sweep position)
    if (sweepCurrentX > startX) {
      // Glow underbeam
      this.sweepGfx
        .moveTo(startX, sweepLineY)
        .lineTo(sweepCurrentX, sweepLineY)
        .stroke({ color: primaryColorNum, width: 6, alpha: 0.3 * lineFade });

      // Crisp beam
      this.sweepGfx
        .moveTo(startX, sweepLineY)
        .lineTo(sweepCurrentX, sweepLineY)
        .stroke({ color: primaryColorNum, width: 2.5, alpha: 0.9 * lineFade });
    }

    // 3. Draw energetic laser head
    if (sweepProgress > 0 && sweepProgress < 1) {
      // Outer pulse
      const pulseR = 8 + Math.sin(tMs * 0.02) * 3;
      this.sweepGfx
        .circle(sweepCurrentX, sweepLineY, pulseR)
        .fill({ color: accentColorNum, alpha: 0.35 * lineFade });

      // Core head
      this.sweepGfx
        .circle(sweepCurrentX, sweepLineY, 3.5)
        .fill({ color: 0xffffff, alpha: 1.0 * lineFade });
    }

    // 4. Words reaction as sweep passes
    let currentX = startX;

    for (let i = 0; i < this.wordTexts.length; i++) {
      const textSprite = this.wordTexts[i];
      if (i >= words.length) {
        textSprite.visible = false;
        continue;
      }

      const wWidth = wordWidths[i] * scaleRatio;
      const wordCenter = currentX + wWidth / 2;
      currentX += wWidth + spacing * scaleRatio;

      textSprite.visible = true;

      // Distance from sweep head to word center
      const distFromSweep = sweepCurrentX - wordCenter;
      const halfW = (wWidth / 2) + 15;

      if (distFromSweep < -halfW) {
        // Ahead of sweep - waiting
        textSprite.x = wordCenter;
        textSprite.y = centerY;
        textSprite.scale.set(scaleRatio);
        textSprite.alpha = 0.45 * lineFade;
        textSprite.style.fill = textColorNum;
      } else if (Math.abs(distFromSweep) <= halfW) {
        // Right as the sweep passes under!
        const hitNorm = 1.0 - Math.abs(distFromSweep) / halfW;
        // Elastic pop
        const scaleBounce = 1.0 + hitNorm * 0.28;
        const lift = hitNorm * 8;

        textSprite.x = wordCenter;
        textSprite.y = centerY - lift;
        textSprite.scale.set(scaleRatio * scaleBounce);
        textSprite.alpha = 1.0 * lineFade;
        textSprite.style.fill = accentColorNum;

        // Sparkle dot above word
        this.sweepGfx
          .circle(wordCenter, centerY - lift - fontSize * 0.6, 2)
          .fill({ color: accentColorNum, alpha: hitNorm * lineFade });
      } else {
        // Sweep has passed - lit up
        textSprite.x = wordCenter;
        textSprite.y = centerY;
        textSprite.scale.set(scaleRatio * 1.02);
        textSprite.alpha = 0.95 * lineFade;
        textSprite.style.fill = primaryColorNum;
      }
    }
  }

  public resize(_width: number, _height: number): void {}

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}

