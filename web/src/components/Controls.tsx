import React, { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Maximize,
  Minimize,
  Sliders,
  Palette,
  Layers,
  Music,
  ChevronDown,
  Server
} from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { DEFAULT_THEMES } from '../engine/types';
import { SceneType } from '@kinetic-lyrics/shared';

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export const Controls: React.FC<{
  onSelectSample: (index: number) => void;
  selectedSample: number;
}> = ({ onSelectSample, selectedSample }) => {
  const {
    isPlaying,
    currentTimeMs,
    durationMs,
    offsetMs,
    themeKey,
    sceneOverride,
    isFullscreen,
    track,
    isExtensionMode,
    backendUrl,
    togglePlay,
    seek,
    setOffset,
    setThemeKey,
    setSceneOverride,
    setBackendUrl,
    toggleFullscreen
  } = usePlayerStore();

  const [showSettings, setShowSettings] = useState(false);
  const [localBackendUrl, setLocalBackendUrl] = useState(backendUrl);

  const progressPercent = durationMs > 0 ? Math.min(100, (currentTimeMs / durationMs) * 100) : 0;

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const targetMs = (val / 100) * durationMs;
    seek(targetMs);
  };

  const handleOffsetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOffset(parseInt(e.target.value, 10));
  };

  const handleBackendUrlBlur = () => {
    if (localBackendUrl.trim()) {
      setBackendUrl(localBackendUrl.trim());
    }
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-50 p-6 pointer-events-none transition-opacity duration-300">
      <div className="max-w-4xl mx-auto backdrop-blur-xl bg-black/60 border border-white/10 rounded-2xl p-4 shadow-2xl pointer-events-auto flex flex-col gap-3">
        {/* Progress Bar & Scrubber */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-zinc-400 min-w-[42px] text-right">
            {formatTime(currentTimeMs)}
          </span>
          <div className="relative flex-1 group flex items-center">
            <input
              type="range"
              min="0"
              max="100"
              step="0.05"
              value={progressPercent}
              onChange={handleSeek}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:h-2.5 transition-all"
              style={{
                background: `linear-gradient(to right, #6366f1 0%, #a855f7 ${progressPercent}%, #27272a ${progressPercent}%, #27272a 100%)`
              }}
            />
          </div>
          <span className="text-xs font-mono text-zinc-400 min-w-[42px]">
            {formatTime(durationMs)}
          </span>
        </div>

        {/* Bottom Bar: Track Info, Main Buttons, Quick Controls */}
        <div className="flex items-center justify-between gap-4">
          {/* Left: Track Details & Sample Selector */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-fuchsia-500 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
              <Music className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-white truncate tracking-tight">{track.title}</div>
              <div className="text-xs text-zinc-400 truncate">{track.artist || 'Unknown Artist'}</div>
            </div>

            {/* In Standalone Mode: Sample Selector Dropdown */}
            {!isExtensionMode && (
              <div className="relative ml-2">
                <select
                  value={selectedSample}
                  onChange={e => onSelectSample(parseInt(e.target.value, 10))}
                  className="bg-zinc-800/80 border border-zinc-700/60 rounded-lg text-xs text-zinc-300 py-1.5 px-2.5 pr-7 appearance-none cursor-pointer hover:bg-zinc-700/80 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value={0}>Sample 1: Synthwave</option>
                  <option value={1}>Sample 2: Starlight (Fast)</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2 top-2.5 pointer-events-none" />
              </div>
            )}
          </div>

          {/* Center: Play / Pause / Reset */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => seek(0)}
              title="Restart song"
              className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={togglePlay}
              className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl font-bold"
              title="Play / Pause (Space)"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-black" /> : <Play className="w-5 h-5 fill-black ml-0.5" />}
            </button>
          </div>

          {/* Right: Scene Selector, Settings, Fullscreen */}
          <div className="flex items-center gap-2">
            {/* Scene Dropdown */}
            <div className="relative flex items-center">
              <Layers className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 pointer-events-none" />
              <select
                value={sceneOverride}
                onChange={e => setSceneOverride(e.target.value as SceneType)}
                className="bg-zinc-800/80 border border-zinc-700/60 rounded-lg text-xs text-zinc-300 py-1.5 pl-8 pr-7 appearance-none cursor-pointer hover:bg-zinc-700/80 focus:outline-none"
              >
                <option value="auto">Scene: Auto</option>
                <option value="drift">Drift</option>
                <option value="dotMorph">Dot Morph</option>
                <option value="lineSweep">Line Sweep</option>
                <option value="pulse">Pulse</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2 pointer-events-none" />
            </div>

            {/* Theme Picker */}
            <div className="relative flex items-center">
              <Palette className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 pointer-events-none" />
              <select
                value={themeKey}
                onChange={e => setThemeKey(e.target.value)}
                className="bg-zinc-800/80 border border-zinc-700/60 rounded-lg text-xs text-zinc-300 py-1.5 pl-8 pr-7 appearance-none cursor-pointer hover:bg-zinc-700/80 focus:outline-none"
              >
                {Object.keys(DEFAULT_THEMES).map(k => (
                  <option key={k} value={k}>
                    {DEFAULT_THEMES[k].name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2 pointer-events-none" />
            </div>

            {/* Sync Settings Toggle */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg border transition ${
                showSettings
                  ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                  : 'bg-zinc-800/80 border-zinc-700/60 text-zinc-300 hover:bg-zinc-700'
              }`}
              title="Timing offset & sync settings"
            >
              <Sliders className="w-4 h-4" />
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg bg-zinc-800/80 border border-zinc-700/60 text-zinc-300 hover:bg-zinc-700 transition"
              title="Fullscreen (F)"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Collapsible Timing Offset & Extension Settings Drawer */}
        {showSettings && (
          <div className="mt-2 pt-3 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400">
            <div className="flex items-center gap-3 flex-1 max-w-md w-full">
              <span className="font-medium text-zinc-300 shrink-0">Timing Offset:</span>
              <input
                type="range"
                min="-2000"
                max="2000"
                step="25"
                value={offsetMs}
                onChange={handleOffsetChange}
                className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-400"
              />
              <span className="font-mono min-w-[60px] text-zinc-300">
                {offsetMs > 0 ? `+${offsetMs}ms` : `${offsetMs}ms`}
              </span>
              <button
                onClick={() => setOffset(0)}
                className="text-xs text-indigo-400 hover:text-indigo-300 underline"
              >
                Reset
              </button>
            </div>

            {/* Backend URL input for Extension Mode */}
            {isExtensionMode && (
              <div className="flex items-center gap-2">
                <Server className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="text-zinc-400 text-[11px]">Backend:</span>
                <input
                  type="text"
                  value={localBackendUrl}
                  onChange={(e) => setLocalBackendUrl(e.target.value)}
                  onBlur={handleBackendUrlBlur}
                  placeholder="http://localhost:8080"
                  className="bg-zinc-800/80 border border-zinc-700 rounded px-2 py-0.5 text-zinc-200 text-xs w-40 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            )}

            <div className="flex items-center gap-2 text-zinc-500 text-[11px]">
              <span>[ / ] offset ±50ms • Space play • F fullscreen • S cycle scenes</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
