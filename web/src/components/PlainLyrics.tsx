import React, { useEffect, useRef } from 'react';

export const PlainLyrics: React.FC<{
  plainText: string;
  isPlaying: boolean;
  progressPercent: number;
}> = ({ plainText, progressPercent }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Gentle auto-scroll based on track progress
  useEffect(() => {
    if (containerRef.current) {
      const scrollHeight = containerRef.current.scrollHeight - containerRef.current.clientHeight;
      if (scrollHeight > 0) {
        containerRef.current.scrollTo({
          top: scrollHeight * (progressPercent / 100),
          behavior: 'smooth'
        });
      }
    }
  }, [progressPercent]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 flex flex-col items-center justify-center p-8 overflow-y-auto no-scrollbar pointer-events-none select-text"
    >
      <div className="max-w-xl text-center space-y-4 text-zinc-300 font-sans text-xl leading-relaxed py-32">
        {plainText.split('\n').map((line, idx) => (
          <p
            key={idx}
            className={line.trim() ? 'opacity-85 hover:opacity-100 transition-opacity' : 'h-6'}
          >
            {line}
          </p>
        ))}
      </div>
    </div>
  );
};

