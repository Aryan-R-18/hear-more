import { describe, it, expect } from 'vitest';
import { calculateWordTimings, estimateSyllables } from './timing';

describe('Word Timing & Syllable Estimation', () => {
  describe('estimateSyllables', () => {
    it('estimates syllables for single-syllable words', () => {
      expect(estimateSyllables('night')).toBe(1);
      expect(estimateSyllables('rain')).toBe(1);
      expect(estimateSyllables('glow')).toBe(1);
      expect(estimateSyllables('break')).toBe(1);
    });

    it('estimates syllables for multi-syllable words', () => {
      expect(estimateSyllables('shadows')).toBeGreaterThanOrEqual(2);
      expect(estimateSyllables('frequencies')).toBeGreaterThanOrEqual(3);
      expect(estimateSyllables('digital')).toBeGreaterThanOrEqual(3);
    });

    it('handles silent e endings properly', () => {
      expect(estimateSyllables('time')).toBe(1);
      expect(estimateSyllables('make')).toBe(1);
    });
  });

  describe('calculateWordTimings', () => {
    it('calculates word timings with 5% end gap', () => {
      const lineText = 'In the neon glow';
      const start = 10.0;
      const end = 14.0; // 4 seconds total
      const words = calculateWordTimings(lineText, start, end, 0.05);

      expect(words).toHaveLength(4);
      expect(words[0].text).toBe('In');
      expect(words[3].text).toBe('glow');

      // First word starts exactly at line start
      expect(words[0].start).toBe(10.0);

      // Last word ends with gap preserved (4s * 0.95 = 3.8s active -> ends at 13.8)
      expect(words[3].end).toBeLessThanOrEqual(13.81);
      expect(words[3].end).toBeGreaterThanOrEqual(13.75);

      // Verify contiguous non-overlapping intervals
      for (let i = 0; i < words.length - 1; i++) {
        expect(words[i].start).toBeLessThan(words[i].end);
        expect(words[i].end).toBeCloseTo(words[i + 1].start, 2);
      }
    });

    it('returns empty array for empty or whitespace text', () => {
      expect(calculateWordTimings('', 0, 5)).toEqual([]);
      expect(calculateWordTimings('   ', 0, 5)).toEqual([]);
    });

    it('weights longer/multisyllabic words with longer duration', () => {
      const lineText = 'I see extraordinary constellations';
      const words = calculateWordTimings(lineText, 0, 10);
      const shortWord = words[0]; // 'I'
      const longWord = words[2]; // 'extraordinary'

      const shortDuration = shortWord.end - shortWord.start;
      const longDuration = longWord.end - longWord.start;

      expect(longDuration).toBeGreaterThan(shortDuration * 2);
    });
  });
});

