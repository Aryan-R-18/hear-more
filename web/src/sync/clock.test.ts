import { describe, it, expect } from 'vitest';
import { PlaybackClock } from './clock';

describe('PlaybackClock', () => {
  it('initializes in paused state at 0 position', () => {
    let mockNow = 1000;
    const clock = new PlaybackClock(0, () => mockNow);

    expect(clock.isPlaying()).toBe(false);
    expect(clock.getPositionMs()).toBe(0);
    expect(clock.getTime()).toBe(0);
  });

  it('extrapolates time while playing', () => {
    let mockNow = 1000;
    const clock = new PlaybackClock(0, () => mockNow);

    clock.play();
    expect(clock.isPlaying()).toBe(true);

    // Advance mock time by 500ms
    mockNow += 500;
    expect(clock.getPositionMs()).toBe(500);
    expect(clock.getTime()).toBe(0.5);

    // Advance another 1000ms
    mockNow += 1000;
    expect(clock.getPositionMs()).toBe(1500);
    expect(clock.getTime()).toBe(1.5);
  });

  it('freezes time on pause', () => {
    let mockNow = 1000;
    const clock = new PlaybackClock(0, () => mockNow);

    clock.play();
    mockNow += 2000;
    clock.pause();

    expect(clock.isPlaying()).toBe(false);
    expect(clock.getPositionMs()).toBe(2000);

    // Advancing wall clock after pause should not advance playback position
    mockNow += 5000;
    expect(clock.getPositionMs()).toBe(2000);
    expect(clock.getTime()).toBe(2.0);
  });

  it('handles seek accurately while paused and while playing', () => {
    let mockNow = 1000;
    const clock = new PlaybackClock(0, () => mockNow);

    clock.seek(45000); // 45 seconds
    expect(clock.getPositionMs()).toBe(45000);

    clock.play();
    mockNow += 1200;
    expect(clock.getPositionMs()).toBe(46200);

    // Seek backwards while playing
    clock.seek(10000);
    expect(clock.getPositionMs()).toBe(10000);

    mockNow += 300;
    expect(clock.getPositionMs()).toBe(10300);
  });

  it('adjusts for playback rate changes', () => {
    let mockNow = 1000;
    const clock = new PlaybackClock(0, () => mockNow);

    clock.play();
    mockNow += 1000; // 1s at 1.0x -> 1000ms
    expect(clock.getPositionMs()).toBe(1000);

    // Change rate to 1.5x
    clock.setRate(1.5);
    mockNow += 1000; // 1s at 1.5x -> +1500ms -> 2500ms
    expect(clock.getPositionMs()).toBe(2500);
  });

  it('applies user offset within ±2000ms range', () => {
    let mockNow = 1000;
    const clock = new PlaybackClock(0, () => mockNow);

    clock.seek(5000);
    clock.setOffset(200); // +200ms
    expect(clock.getPositionMs()).toBe(5200);
    expect(clock.getRawPositionMs()).toBe(5000);

    clock.setOffset(-500); // -500ms
    expect(clock.getPositionMs()).toBe(4500);

    // Clamps to max 2000ms
    clock.setOffset(3500);
    expect(clock.getOffset()).toBe(2000);
    expect(clock.getPositionMs()).toBe(7000);

    // Clamps to min -2000ms
    clock.setOffset(-4000);
    expect(clock.getOffset()).toBe(-2000);
    expect(clock.getPositionMs()).toBe(3000);
  });

  it('syncs from external player state', () => {
    let mockNow = 2000;
    const clock = new PlaybackClock(0, () => mockNow);

    // Simulate state coming from content script 50ms ago
    clock.syncState({
      positionMs: 12000,
      playing: true,
      rate: 1.0,
      timestamp: 1950 // 50ms transit latency
    });

    expect(clock.isPlaying()).toBe(true);
    // Extrapolates forward by 50ms latency
    expect(clock.getPositionMs()).toBe(12050);
  });
});

