export interface SampledPoint {
  x: number;
  y: number;
  alpha: number;
}

export class TextSampler {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private cache: Map<string, { points: SampledPoint[]; width: number; height: number }> = new Map();

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1200;
    this.canvas.height = 400;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  public sampleText(
    text: string,
    fontSize: number = 72,
    fontFamily: string = '"Syne", "Plus Jakarta Sans", sans-serif',
    maxPoints: number = 2500
  ): { points: SampledPoint[]; width: number; height: number } {
    const key = `${text}__${fontSize}__${fontFamily}`;
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    if (!this.ctx || !text.trim()) {
      return { points: [], width: 0, height: 0 };
    }

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.font = `800 ${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';

    const metrics = ctx.measureText(text);
    const textWidth = Math.ceil(metrics.width);
    const textHeight = Math.ceil(fontSize * 1.3);

    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    ctx.fillText(text, centerX, centerY);

    const startX = Math.max(0, Math.floor(centerX - textWidth / 2 - 10));
    const startY = Math.max(0, Math.floor(centerY - textHeight / 2 - 10));
    const sampleW = Math.min(this.canvas.width - startX, textWidth + 20);
    const sampleH = Math.min(this.canvas.height - startY, textHeight + 20);

    const imgData = ctx.getImageData(startX, startY, sampleW, sampleH);
    const data = imgData.data;

    // Calculate grid step to ensure we do not exceed maxPoints
    const rawPixels = [];
    const step = Math.max(2, Math.floor(Math.sqrt((sampleW * sampleH) / 8000)));

    for (let y = 0; y < sampleH; y += step) {
      for (let x = 0; x < sampleW; x += step) {
        const index = (y * sampleW + x) * 4;
        const alpha = data[index + 3];
        if (alpha > 120) {
          rawPixels.push({
            x: startX + x - centerX,
            y: startY + y - centerY,
            alpha: alpha / 255
          });
        }
      }
    }

    // If still too many points, subsample down to maxPoints
    let resultPoints: SampledPoint[];
    if (rawPixels.length > maxPoints) {
      const skipRatio = rawPixels.length / maxPoints;
      resultPoints = [];
      for (let i = 0; i < maxPoints; i++) {
        const idx = Math.floor(i * skipRatio);
        if (rawPixels[idx]) {
          resultPoints.push(rawPixels[idx]);
        }
      }
    } else {
      resultPoints = rawPixels;
    }

    const result = {
      points: resultPoints,
      width: textWidth,
      height: textHeight
    };

    // Cache limit to avoid unbounded memory
    if (this.cache.size > 200) {
      this.cache.clear();
    }
    this.cache.set(key, result);

    return result;
  }
}

