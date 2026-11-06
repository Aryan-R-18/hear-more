import { describe, it, expect } from 'vitest';
import { parseLrc, parseTimestamp } from './lrc';

describe('LRC Parser', () => {
  describe('parseTimestamp', () => {
    it('parses mm:ss.xx correctly', () => {
      expect(parseTimestamp('01:23.45')).toBeCloseTo(83.45, 2);
      expect(parseTimestamp('00:05.10')).toBeCloseTo(5.1, 2);
      expect(parseTimestamp('02:00.00')).toBe(120);
    });

    it('parses mm:ss.xxx correctly', () => {
      expect(parseTimestamp('01:05.123')).toBeCloseTo(65.123, 3);
    });

    it('returns null for invalid timestamps', () => {
      expect(parseTimestamp('invalid')).toBeNull();
      expect(parseTimestamp('')).toBeNull();
    });
  });

  describe('parseLrc', () => {
    it('parses metadata tags and standard lyric lines', () => {
      const lrcContent = `
[ti:Test Title]
[ar:Test Artist]
[al:Test Album]
[00:05.00]First line
[00:10.00]Second line
[00:15.00]Final line
      `.trim();

      const result = parseLrc(lrcContent);
      expect(result.metadata.title).toBe('Test Title');
      expect(result.metadata.artist).toBe('Test Artist');
      expect(result.metadata.album).toBe('Test Album');

      expect(result.lines).toHaveLength(3);

      // Line 1: start 5.00, end 10.00 (start of line 2)
      expect(result.lines[0].start).toBe(5.0);
      expect(result.lines[0].end).toBe(10.0);
      expect(result.lines[0].text).toBe('First line');
      expect(result.lines[0].words).toHaveLength(2);

      // Line 2: start 10.00, end 15.00
      expect(result.lines[1].start).toBe(10.0);
      expect(result.lines[1].end).toBe(15.0);
      expect(result.lines[1].text).toBe('Second line');

      // Final line: start 15.00, end 19.00 (+4.0s for last line)
      expect(result.lines[2].start).toBe(15.0);
      expect(result.lines[2].end).toBe(19.0);
      expect(result.lines[2].text).toBe('Final line');
    });

    it('handles multiple timestamps per line by duplicating and sorting', () => {
      const lrcContent = `
[00:10.00]Intro
[00:20.00][00:40.00]Repeated chorus phrase
[00:30.00]Verse 1
      `.trim();

      const result = parseLrc(lrcContent);
      expect(result.lines).toHaveLength(4);

      // Check chronological order
      expect(result.lines[0].start).toBe(10.0);
      expect(result.lines[0].text).toBe('Intro');

      expect(result.lines[1].start).toBe(20.0);
      expect(result.lines[1].text).toBe('Repeated chorus phrase');

      expect(result.lines[2].start).toBe(30.0);
      expect(result.lines[2].text).toBe('Verse 1');

      expect(result.lines[3].start).toBe(40.0);
      expect(result.lines[3].text).toBe('Repeated chorus phrase');
    });

    it('handles empty lines as instrumental gaps ending previous line', () => {
      const lrcContent = `
[00:10.00]Vocal line before break
[00:15.00]
[00:25.00]Vocal line after break
      `.trim();

      const result = parseLrc(lrcContent);
      expect(result.lines).toHaveLength(3);

      // Line before break ends at break timestamp (15.0s)
      expect(result.lines[0].start).toBe(10.0);
      expect(result.lines[0].end).toBe(15.0);

      // Instrumental break line has empty text and empty words
      expect(result.lines[1].start).toBe(15.0);
      expect(result.lines[1].end).toBe(25.0);
      expect(result.lines[1].text).toBe('');
      expect(result.lines[1].words).toEqual([]);

      // Next line starts at 25.0s
      expect(result.lines[2].start).toBe(25.0);
    });
  });
});

