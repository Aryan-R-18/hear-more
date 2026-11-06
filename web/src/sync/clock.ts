export interface ClockState {
  positionMs: number;
  wallClockMs: number;
  playing: boolean;
  rate: number;
}

export class PlaybackClock {
  private positionMs: number = 0;
  private wallClockMs: number = 0;
  private playing: boolean = false;
  private rate: number = 1.0;
  private offsetMs: number = 0; // ±2000 ms
  private durationMs: number = Infinity;
  private nowFn: () => number;

  constructor(initialOffsetMs: number = 0, nowFn: () => number = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    this.offsetMs = Math.min(2000, Math.max(-2000, initialOffsetMs));
    this.nowFn = nowFn;
    this.wallClockMs = this.nowFn();
  }

  public play(): void {
    if (!this.playing) {
      this.wallClockMs = this.nowFn();
      this.playing = true;
    }
  }

  public pause(): void {
    if (this.playing) {
      this.positionMs = this.getRawPositionMs();
      this.playing = false;
    }
  }

  public togglePlay(): boolean {
    if (this.playing) {
      this.pause();
    } else {
      this.play();
    }
    return this.playing;
  }

  public seek(targetMs: number): void {
    const clamped = Math.max(0, Math.min(this.durationMs, targetMs));
    this.positionMs = clamped;
    this.wallClockMs = this.nowFn();
  }

  public setRate(newRate: number): void {
    if (newRate <= 0) return;
    // Anchor current position before updating rate
    this.positionMs = this.getRawPositionMs();
    this.wallClockMs = this.nowFn();
    this.rate = newRate;
  }

  public setOffset(offsetMs: number): void {
    this.offsetMs = Math.min(2000, Math.max(-2000, offsetMs));
  }

  public setDuration(durationSec: number): void {
    this.durationMs = durationSec > 0 ? durationSec * 1000 : Infinity;
  }

  /**
   * Sync external player state (from content script or mock player)
   */
  public syncState(state: {
    positionMs: number;
    playing: boolean;
    rate?: number;
    timestamp?: number;
    duration?: number;
  }): void {
    const now = this.nowFn();
    const serverTimestamp = state.timestamp ?? now;
    const latency = Math.max(0, now - serverTimestamp);

    const rate = state.rate ?? this.rate;
    this.rate = rate;
    this.playing = state.playing;

    if (state.duration !== undefined) {
      this.setDuration(state.duration);
    }

    if (this.playing) {
      // Extrapolate forward by elapsed transit latency
      this.positionMs = Math.max(0, state.positionMs + latency * rate);
      this.wallClockMs = now;
    } else {
      this.positionMs = Math.max(0, state.positionMs);
      this.wallClockMs = now;
    }
  }

  /**
   * Returns current raw position in ms without user offset applied.
   */
  public getRawPositionMs(): number {
    if (!this.playing) {
      return this.positionMs;
    }
    const elapsed = this.nowFn() - this.wallClockMs;
    const pos = this.positionMs + elapsed * this.rate;
    return Math.min(this.durationMs, Math.max(0, pos));
  }

  /**
   * Returns current playback position in milliseconds including user offset.
   */
  public getPositionMs(): number {
    const raw = this.getRawPositionMs();
    return Math.max(0, raw + this.offsetMs);
  }

  /**
   * Requirement: expose getTime() returning current extrapolated time in seconds.
   */
  public getTime(): number {
    return this.getPositionMs() / 1000;
  }

  public isPlaying(): boolean {
    return this.playing;
  }

  public getRate(): number {
    return this.rate;
  }

  public getOffset(): number {
    return this.offsetMs;
  }

  public getStateSnapshot(): ClockState & { offsetMs: number; currentTimeMs: number } {
    return {
      positionMs: this.positionMs,
      wallClockMs: this.wallClockMs,
      playing: this.playing,
      rate: this.rate,
      offsetMs: this.offsetMs,
      currentTimeMs: this.getPositionMs()
    };
  }
}

