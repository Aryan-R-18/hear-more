export interface PooledParticle {
  id: number;
  active: boolean;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  originX: number;
  originY: number;
  scatterX: number;
  scatterY: number;
  size: number;
  alpha: number;
  color: number;
  seed: number;
}

export class ParticlePool {
  private static readonly MAX_PARTICLES = 3000;
  private pool: PooledParticle[];
  private activeCount: number = 0;

  constructor(maxSize: number = ParticlePool.MAX_PARTICLES) {
    const size = Math.min(maxSize, ParticlePool.MAX_PARTICLES);
    this.pool = new Array(size);

    for (let i = 0; i < size; i++) {
      this.pool[i] = {
        id: i,
        active: false,
        x: 0,
        y: 0,
        targetX: 0,
        targetY: 0,
        originX: 0,
        originY: 0,
        scatterX: 0,
        scatterY: 0,
        size: 2.0,
        alpha: 1.0,
        color: 0xffffff,
        seed: Math.random()
      };
    }
  }

  public get capacity(): number {
    return this.pool.length;
  }

  public get count(): number {
    return this.activeCount;
  }

  public reset(): void {
    for (let i = 0; i < this.activeCount; i++) {
      this.pool[i].active = false;
    }
    this.activeCount = 0;
  }

  public acquire(): PooledParticle | null {
    if (this.activeCount >= this.pool.length) {
      return null; // Particle cap reached (capped at 3000)
    }

    const particle = this.pool[this.activeCount++];
    particle.active = true;
    particle.alpha = 1.0;
    return particle;
  }

  public getActiveParticles(): PooledParticle[] {
    return this.pool.slice(0, this.activeCount);
  }
}

