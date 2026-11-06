import React, { useEffect, useState, useRef } from 'react';
import { Visualizer } from './components/Visualizer';
import { Controls } from './components/Controls';
import { PlainLyrics } from './components/PlainLyrics';
import { usePlayerStore } from './store/playerStore';
import sampleLrc1 from './assets/sample.lrc?raw';
import sampleLrc2 from './assets/sample2.lrc?raw';
import { SceneType } from '@kinetic-lyrics/shared';

const SAMPLES = [
  {
    lrc: sampleLrc1,
    title: 'Midnight City Drive',
    artist: 'Synthwave Collective',
    duration: 135
  },
  {
    lrc: sampleLrc2,
    title: 'Starlight Velocity',
    artist: 'Nova Pulse',
    duration: 50
  }
];

export const App: React.FC = () => {
  const [selectedSample, setSelectedSample] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const hideTimerRef = useRef<number | null>(null);

  const {
    isPlaying,
    currentTimeMs,
    durationMs,
    offsetMs,
    sceneOverride,
    isSynced,
    plainLyrics,
    togglePlay,
    seek,
    setOffset,
    setSceneOverride,
    toggleFullscreen,
    loadLrcText
  } = usePlayerStore();

  // Load initial sample
  useEffect(() => {
    const sample = SAMPLES[selectedSample];
    loadLrcText(sample.lrc, {
      title: sample.title,
      artist: sample.artist,
      duration: sample.duration
    });
  }, [selectedSample, loadLrcText]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === 'BracketLeft') {
        e.preventDefault();
        setOffset(offsetMs - 50);
      } else if (e.code === 'BracketRight') {
        e.preventDefault();
        setOffset(offsetMs + 50);
      } else if (e.code === 'KeyS') {
        e.preventDefault();
        const scenes: SceneType[] = ['auto', 'drift', 'dotMorph', 'lineSweep', 'pulse'];
        const currentIdx = scenes.indexOf(sceneOverride);
        const nextScene = scenes[(currentIdx + 1) % scenes.length];
        setSceneOverride(nextScene);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        seek(Math.max(0, currentTimeMs - 5000));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        seek(Math.min(durationMs, currentTimeMs + 5000));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, toggleFullscreen, setOffset, offsetMs, sceneOverride, setSceneOverride, seek, currentTimeMs, durationMs]);

  // Auto-hide controls on mouse idle
  const handleMouseMove = () => {
    setShowControls(true);
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
    }
    if (isPlaying) {
      hideTimerRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, 3500);
    }
  };

  const progressPercent = durationMs > 0 ? (currentTimeMs / durationMs) * 100 : 0;

  return (
    <div
      onMouseMove={handleMouseMove}
      className={`relative w-screen h-screen overflow-hidden bg-black font-sans select-none ${
        !showControls && isPlaying ? 'cursor-none' : ''
      }`}
    >
      {/* Pixi Visualizer Canvas */}
      <Visualizer />

      {/* Plain Lyrics fallback if not time-synced */}
      {!isSynced && plainLyrics && (
        <PlainLyrics
          plainText={plainLyrics}
          isPlaying={isPlaying}
          progressPercent={progressPercent}
        />
      )}

      {/* Floating Header Branding */}
      <div
        className={`absolute top-6 left-6 z-40 transition-opacity duration-300 pointer-events-none ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_12px_#22d3ee]" />
          <span className="text-xs font-black tracking-widest uppercase text-white/70">
            Kinetic Lyrics
          </span>
          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/50">
            Phase 1
          </span>
        </div>
      </div>

      {/* Controls Overlay */}
      <div className={`transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <Controls
          selectedSample={selectedSample}
          onSelectSample={setSelectedSample}
        />
      </div>
    </div>
  );
};

