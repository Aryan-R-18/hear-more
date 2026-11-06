import { LyricLine } from '@kinetic-lyrics/shared';
import { calculateWordTimings } from './timing';

export interface LrcMetadata {
  title?: string;
  artist?: string;
  album?: string;
  offset?: number; // ms
}

export interface ParsedLrc {
  metadata: LrcMetadata;
  lines: LyricLine[];
}

/**
 * Parses timestamp string e.g. "01:23.45" or "01:23.456" or "01:23" into seconds.
 */
export function parseTimestamp(ts: string): number | null {
  const parts = ts.trim().split(':');
  if (parts.length < 2) return null;

  const minutes = parseFloat(parts[0]);
  const seconds = parseFloat(parts[1]);

  if (isNaN(minutes) || isNaN(seconds)) return null;
  return minutes * 60 + seconds;
}

/**
 * Parses LRC content into structured LyricLines with words and calculated start/end times.
 */
export function parseLrc(lrcContent: string): ParsedLrc {
  const metadata: LrcMetadata = {};
  const rawItems: { time: number; text: string }[] = [];

  const lines = lrcContent.split(/\r?\n/);
  const timeRegex = /\[(\d{1,2}:\d{2}(?:\.\d{1,3})?)\]/g;
  const metaRegex = /^\[(ti|ar|al|offset):([^\]]*)\]/i;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Check metadata tags e.g. [ti:Song Title]
    const metaMatch = trimmed.match(metaRegex);
    if (metaMatch) {
      const key = metaMatch[1].toLowerCase();
      const value = metaMatch[2].trim();
      if (key === 'ti') metadata.title = value;
      else if (key === 'ar') metadata.artist = value;
      else if (key === 'al') metadata.album = value;
      else if (key === 'offset') metadata.offset = parseInt(value, 10) || 0;
      continue;
    }

    // Extract all timestamps in the line
    const timestamps: number[] = [];
    let match: RegExpExecArray | null;
    let lastIndex = 0;

    while ((match = timeRegex.exec(trimmed)) !== null) {
      const t = parseTimestamp(match[1]);
      if (t !== null) {
        timestamps.push(t);
      }
      lastIndex = timeRegex.lastIndex;
    }

    if (timestamps.length > 0) {
      // The text is whatever is left after removing timestamp tags
      const lyricText = trimmed.slice(lastIndex).trim();

      for (const t of timestamps) {
        rawItems.push({
          time: t,
          text: lyricText
        });
      }
    }
  }

  // Sort chronologically by start time
  rawItems.sort((a, b) => a.time - b.time);

  // If offset is specified in metadata, apply it (offset in ms)
  const offsetSeconds = (metadata.offset || 0) / 1000;
  if (offsetSeconds !== 0) {
    for (const item of rawItems) {
      item.time = Math.max(0, item.time + offsetSeconds);
    }
  }

  // Calculate start, end, and words for each line
  const resultLines: LyricLine[] = [];

  for (let i = 0; i < rawItems.length; i++) {
    const current = rawItems[i];
    let end: number;

    if (i + 1 < rawItems.length) {
      end = rawItems[i + 1].time;
    } else {
      // Last line: +4 seconds as specified in requirements
      end = current.time + 4.0;
    }

    // Guard against malformed overlapping timestamps
    if (end <= current.time) {
      end = current.time + 1.0;
    }

    const words = calculateWordTimings(current.text, current.time, end);

    resultLines.push({
      start: Number(current.time.toFixed(3)),
      end: Number(end.toFixed(3)),
      text: current.text,
      words
    });
  }

  return {
    metadata,
    lines: resultLines
  };
}

