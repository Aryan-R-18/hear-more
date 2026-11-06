import { Application, Container, Graphics, Text } from 'pixi.js';
import { RenderContext, Scene } from '../engine/types';
import { SceneType } from '@kinetic-lyrics/shared';

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function hexToNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), 16) || 0xffffff;
}

export class PulseScene implements Scene {
  public readonly id: SceneType = 'pulse';
  public readonly name = 'Pulse';

  private container: Container = new Container();
  private shockwaveGfx: Graphics = new Graphics();
  private mainText: Text;
  private prevText: Text;
  private nextText: Text;
  private echoText: Text; // Layered for blur/glow punch

  constructor() {
    this.mainText = new Text({
      text: '',
      style: {
        fontFamily: '"Syne", "Plus Jakarta Sans", sans-serif',
        fontSize: 88,
        fontWeight: '900',
        fill: 0xffffff,
        align: 'center'
      }
    });
    this.mainText.anchor.set(0.5, 0.5);

    this.echoText = new Text({
      text: '',
      style: {
        fontFamily: '"Syne", "Plus Jakarta Sans", sans-serif',
        fontSize: 88,
        fontWeight: '900',
        fill: 0xff0077,
        align: 'center'
      }
    });
    this.echoText.anchor.set(0.5, 0.5);

    this.prevText = new Text({
      text: '',
      style: {
        fontFamily: '"Plus Jakarta Sans", sans-serif',
        fontSize: 32,
        fontWeight: '600',
        fill: 0x888888,
        align: 'center'
      }
    });
    this.prevText.anchor.set(0.5, 0.5);

    this.nextText = new Text({
      text: '',
      style: {
        fontFamily: '"Plus Jakarta Sans", sans-serif',
        fontSize: 32,
        fontWeight: '600',
        fill: 0x888888,
        align: 'center'
      }
    });
    this.nextText.anchor.set(0.5, 0.5);
  }

  public init(_app: Application, parentContainer: Container): void {
    this.container.removeChildren();
    this.container.addChild(this.shockwaveGfx);
    this.container.addChild(this.prevText);
    this.container.addChild(this.nextText);
    this.container.addChild(this.echoText);
    this.container.addChild(this.mainText);
    parentContainer.addChild(this.container);
  }

  public getContainer(): Container {
    return this.container;
  }

  public render(tMs: number, ctx: RenderContext): void {
    this.shockwaveGfx.clear();

    const line = ctx.currentLine;
    if (!line || !line.words || line.words.length === 0) {
      this.mainText.visible = false;
      this.echoText.visible = false;
      this.prevText.visible = false;
      this.nextText.visible = false;
      return;
    }

    const { width, height, theme } = ctx;
    const words = line.words;
    const activeIdx = ctx.activeWordIndex >= 0 ? ctx.activeWordIndex : 0;
    const activeWord = words[activeIdx] || words[0];

    const primaryColorNum = hexToNumber(theme.primaryColor);
    const accentColorNum = hexToNumber(theme.accentColor);
    const secColorNum = hexToNumber(theme.secondaryColor);
    const textColorNum = hexToNumber(theme.textColor);

    const wStartMs = activeWord.start * 1000;
    const wEndMs = activeWord.end * 1000;
    const durationMs = Math.max(1, wEndMs - wStartMs);

    // Emphasis detection: word length >= 6 characters gets extra power
    const isEmphasis = activeWord.text.replace(/[^a-zA-Z]/g, '').length >= 6;
    const punchMultiplier = isEmphasis ? 1.55 : 1.35;

    // Time elapsed since word start
    const elapsed = tMs - wStartMs;
    const punchDurationMs = Math.min(220, durationMs * 0.5);

    let scale = 1.0;
    let echoAlpha = 0.0;
    let echoScale = 1.0;

    if (tMs < wStartMs) {
      // Transitioning in
      const p = clamp01((tMs - (wStartMs - 150)) / 150);
      scale = 0.85 + p * 0.15;
      this.mainText.alpha = p * 0.7;
    } else if (elapsed <= punchDurationMs) {
      // Explosive punch impact decaying to 1.0
      const p = clamp01(elapsed / punchDurationMs);
      // Ease out expo decay
      const decay = Math.pow(1 - p, 3);
      scale = 1.0 + (punchMultiplier - 1.0) * decay;

      echoScale = 1.0 + (punchMultiplier - 1.0) * 1.4 * decay;
      echoAlpha = decay * 0.6;
      this.mainText.alpha = 1.0;

      // Draw shockwave ring on punch
      const waveRadius = 40 + p * (isEmphasis ? 240 : 160);
      const waveAlpha = (1 - p) * (isEmphasis ? 0.75 : 0.45);
      this.shockwaveGfx
        .circle(width * 0.5, height * 0.5, waveRadius)
        .stroke({ color: accentColorNum, width: isEmphasis ? 3 : 1.5, alpha: waveAlpha });
    } else {
      // Steady hold with subtle breathing
      const holdProgress = clamp01((tMs - (wStartMs + punchDurationMs)) / Math.max(1, durationMs - punchDurationMs));
      scale = 1.0 + Math.sin(holdProgress * Math.PI) * 0.04;
      this.mainText.alpha = 1.0;
      echoAlpha = 0.0;
    }

    // Line exit fade
    const lineEndMs = line.end * 1000;
    if (tMs > lineEndMs - 200) {
      const exitProgress = clamp01((lineEndMs - tMs) / 200);
      this.mainText.alpha *= exitProgress;
      this.shockwaveGfx.alpha = exitProgress;
    }

    const centerX = width * 0.5;
    const centerY = height * 0.5;

    // Calculate dynamic responsive font size
    const maxChars = Math.max(activeWord.text.length, 6);
    const fontSize = Math.min(110, Math.max(48, (width * 0.8) / (maxChars * 0.65)));

    this.mainText.visible = true;
    this.mainText.text = activeWord.text;
    this.mainText.style.fontSize = fontSize;
    this.mainText.style.fill = isEmphasis ? accentColorNum : primaryColorNum;
    this.mainText.x = centerX;
    this.mainText.y = centerY;
    this.mainText.scale.set(scale);

    // Blur / chromatic echo punch
    if (echoAlpha > 0.01) {
      this.echoText.visible = true;
      this.echoText.text = activeWord.text;
      this.echoText.style.fontSize = fontSize;
      this.echoText.style.fill = secColorNum;
      this.echoText.x = centerX + (isEmphasis ? 4 : 2);
      this.echoText.y = centerY;
      this.echoText.scale.set(echoScale);
      this.echoText.alpha = echoAlpha;
    } else {
      this.echoText.visible = false;
    }

    // Context words: previous word above, next word below
    if (activeIdx > 0 && words[activeIdx - 1]) {
      this.prevText.visible = true;
      this.prevText.text = words[activeIdx - 1].text;
      this.prevText.style.fontSize = Math.floor(fontSize * 0.38);
      this.prevText.style.fill = textColorNum;
      this.prevText.alpha = 0.45 * this.mainText.alpha;
      this.prevText.x = centerX;
      this.prevText.y = centerY - fontSize * 0.85;
    } else {
      this.prevText.visible = false;
    }

    if (activeIdx + 1 < words.length && words[activeIdx + 1]) {
      this.nextText.visible = true;
      this.nextText.text = words[activeIdx + 1].text;
      this.nextText.style.fontSize = Math.floor(fontSize * 0.38);
      this.nextText.style.fill = textColorNum;
      this.nextText.alpha = 0.45 * this.mainText.alpha;
      this.nextText.x = centerX;
      this.nextText.y = centerY + fontSize * 0.85;
    } else {
      this.nextText.visible = false;
    }
  }

  public resize(_width: number, _height: number): void {}

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}

