import React, { useEffect, useState, useRef } from 'react';
import { Visualizer } from './components/Visualizer';
import { Controls } from './components/Controls';
import { PlainLyrics } from './components/PlainLyrics';
import { usePlayerStore } from './store/playerStore';
import sampleLrc1 from './assets/sample.lrc?raw';
import sampleLrc2 from './assets/sample2.lrc?raw';
import { SceneType, ExtensionMessage, ExtensionSettings } from '@kinetic-lyrics/shared';
import { Radio } from 'lucide-react';

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
    isExtensionMode,
    isLoadingLyrics,
    lyricsStatusMessage,
    lines,
    track,
    togglePlay,
    seek,
    setOffset,
    setSceneOverride,
    toggleFullscreen,
    loadLrcText,
    setIsExtensionMode,
    applySettings,
    syncPlayerState
  } = usePlayerStore();

  // Extension vs Standalone initialization
  useEffect(() => {
    const isExt = typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
    setIsExtensionMode(isExt);

    if (isExt) {
      // 1. Fetch saved user settings from background
      try {
        chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response?: { settings?: Partial<ExtensionSettings> }) => {
          if (response?.settings) {
            applySettings(response.settings);
          }
        });

        // 2. Query initial playback state
        chrome.runtime.sendMessage({ type: 'GET_PLAYER_STATE' }, (response) => {
          if (response?.state) {
            syncPlayerState(response.state);
          }
        });

        // 3. Subscribe to background broadcasts
        const handleMessage = (message: ExtensionMessage) => {
          if (message.type === 'PLAYER_STATE_UPDATE') {
            syncPlayerState(message.state);
          }
        };

        chrome.runtime.onMessage.addListener(handleMessage);
        return () => {
          chrome.runtime.onMessage.removeListener(handleMessage);
        };
      } catch {
        // Fallback if extension context not ready
      }
    } else {
      // Standalone mode: load initial sample
      const sample = SAMPLES[selectedSample];
      loadLrcText(sample.lrc, {
        title: sample.title,
        artist: sample.artist,
        duration: sample.duration
      });
    }
  }, [isExtensionMode, selectedSample]);

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
  const hasNoSyncedLyrics = !isSynced || lines.length === 0;

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

      {/* Clean Idle / Loading / No Lyrics Display */}
      {hasNoSyncedLyrics && !plainLyrics && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 pointer-events-none z-30">
          <div className="max-w-md text-center flex flex-col items-center gap-4 backdrop-blur-md bg-black/40 border border-white/10 rounded-2xl p-8 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Radio className={`w-6 h-6 text-indigo-400 ${isPlaying || isLoadingLyrics ? 'animate-pulse' : 'opacity-60'}`} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                {isLoadingLyrics
                  ? 'Fetching Synced Lyrics...'
                  : track.title && track.title !== 'Unknown Track'
                  ? track.title
                  : 'Kinetic Lyrics'}
              </h2>
              {track.artist && (
                <p className="text-sm text-zinc-400 mt-0.5">{track.artist}</p>
              )}
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              {lyricsStatusMessage ||
                (isExtensionMode
                  ? 'Play any track on YouTube, YouTube Music, or Spotify Web to visualize live synced lyrics.'
                  : 'Select a sample song below to preview kinetic typography visuals.')}
            </p>
          </div>
        </div>
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
            {isExtensionMode ? 'Extension' : 'Visualizer'}
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
