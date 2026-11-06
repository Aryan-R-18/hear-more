import { LyricWord } from '@kinetic-lyrics/shared';

/**
 * Estimates the number of syllables in an English word using vowel group heuristics.
 */
export function estimateSyllables(word: string): number {
  const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!cleanWord || cleanWord.length <= 2) {
    return 1;
  }

  // Count vowel groups (consecutive vowels like 'ea', 'ou' count as one)
  const vowelMatches = cleanWord.match(/[aeiouy]{1,2}/g);
  let syllables = vowelMatches ? vowelMatches.length : 1;

  // Subtract silent 'e' at the end (e.g., 'make', 'time')
  // but keep 'le' (e.g., 'table', 'little') and double 'ee' (e.g., 'free')
  if (
    cleanWord.endsWith('e') &&
    !cleanWord.endsWith('le') &&
    !cleanWord.endsWith('ee') &&
    cleanWord.length > 2
  ) {
    syllables--;
  }

  // Subtract 'ed' endings unless preceded by d or t (e.g. 'faded', 'wanted')
  if (
    cleanWord.endsWith('ed') &&
    !cleanWord.endsWith('ded') &&
    !cleanWord.endsWith('ted') &&
    cleanWord.length > 3
  ) {
    syllables--;
  }

  return Math.max(1, syllables);
}

/**
 * Splits a line's duration across its words weighted by character count and syllable estimates.
 * Leaves a 5% gap at the end of each line for clean pacing.
 */
export function calculateWordTimings(
  lineText: string,
  lineStart: number,
  lineEnd: number,
  endGapRatio: number = 0.05
): LyricWord[] {
  const trimmed = lineText.trim();
  if (!trimmed) {
    return [];
  }

  // Split line into words preserving words and punctuation
  const rawWords = trimmed.split(/\s+/).filter(w => w.length > 0);
  if (rawWords.length === 0) {
    return [];
  }

  const totalDuration = Math.max(0, lineEnd - lineStart);
  if (totalDuration <= 0) {
    return rawWords.map(w => ({ text: w, start: lineStart, end: lineStart }));
  }

  // Leave a gap (default 5%) at the end of the line
  const activeDuration = totalDuration * (1 - Math.min(0.25, Math.max(0, endGapRatio)));

  // Calculate weights based on character count + syllables
  const weights = rawWords.map(w => {
    const letters = w.replace(/[^a-zA-Z0-9]/g, '').length;
    const syllables = estimateSyllables(w);
    // Character weight + syllable weight
    return Math.max(1, letters * 0.7 + syllables * 1.5);
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  let currentTime = lineStart;
  const words: LyricWord[] = [];

  for (let i = 0; i < rawWords.length; i++) {
    const wordWeight = weights[i];
    const duration = (wordWeight / totalWeight) * activeDuration;
    const start = currentTime;
    const end = i === rawWords.length - 1 ? lineStart + activeDuration : start + duration;

    words.push({
      text: rawWords[i],
      start: Number(start.toFixed(3)),
      end: Number(end.toFixed(3))
    });

    currentTime = end;
  }

  return words;
}

