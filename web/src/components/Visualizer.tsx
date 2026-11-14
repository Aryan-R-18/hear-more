import React, { useEffect, useRef } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { KineticEngine } from '../engine/KineticEngine';

export const Visualizer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<KineticEngine | null>(null);
  const animFrameRef = useRef<number>(0);

  const {
    clock,
    lines,
    theme,
    sceneOverride,
    syncTick
  } = usePlayerStore();

  // Initialize Pixi engine
  useEffect(() => {
    if (!canvasRef.current) return;

    let isMounted = true;
    const engine = new KineticEngine(canvasRef.current);
    engineRef.current = engine;

    engine.init().then(() => {
      if (!isMounted) return;
      engine.setTheme(theme);
      engine.setSceneOverride(sceneOverride);
      engine.setLyrics(lines);
    });

    const handleResize = () => {
      engine.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      isMounted = false;
      window.removeEventListener('resize', handleResize);
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Update theme when changed
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setTheme(theme);
    }
  }, [theme]);

  // Update scene override when changed
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setSceneOverride(sceneOverride);
    }
  }, [sceneOverride]);

  // Update lyrics when changed
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setLyrics(lines);
    }
  }, [lines]);

  // Pure 60fps render loop driven by clock
  useEffect(() => {
    let lastTickTime = 0;

    const renderLoop = () => {
      if (engineRef.current) {
        const tMs = clock.getPositionMs();
        engineRef.current.renderFrame(tMs);

        // Throttle UI store update to ~30fps for minimal React overhead
        const now = performance.now();
        if (now - lastTickTime > 32) {
          syncTick(tMs);
          lastTickTime = now;
        }
      }
      animFrameRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameRef.current = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [clock, syncTick]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full block touch-none cursor-default"
    />
  );
};

