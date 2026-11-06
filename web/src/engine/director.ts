import { LyricLine, SceneType } from '@kinetic-lyrics/shared';

/**
 * Calculates string similarity between two strings (0.0 to 1.0) using bigram Dice coefficient.
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, '');
  const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return 0.0;

  const getBigrams = (str: string) => {
    const bigrams = new Map<string, number>();
    for (let i = 0; i < str.length - 1; i++) {
      const bigram = str.substring(i, i + 2);
      bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
    }
    return bigrams;
  };

  const bg1 = getBigrams(s1);
  const bg2 = getBigrams(s2);
  let intersection = 0;

  for (const [bigram, count1] of bg1.entries()) {
    if (bg2.has(bigram)) {
      intersection += Math.min(count1, bg2.get(bigram)!);
    }
  }

  const total = (s1.length - 1) + (s2.length - 1);
  return (2.0 * intersection) / total;
}

export class SceneDirector {
  private lineSceneMap: Map<number, Exclude<SceneType, 'auto'>> = new Map();
  private chorusLineIndices: Set<number> = new Set();

  /**
   * Analyzes all lines in a track to identify chorus repetitions and assign optimal scenes.
   */
  public analyzeTrack(lines: LyricLine[]): void {
    this.lineSceneMap.clear();
    this.chorusLineIndices.clear();

    if (lines.length === 0) return;

    // 1. Detect chorus lines (lines repeated 2 or more times)
    for (let i = 0; i < lines.length; i++) {
      const lineA = lines[i].text.trim();
      if (lineA.length < 4) continue;

      for (let j = i + 1; j < lines.length; j++) {
        const lineB = lines[j].text.trim();
        const similarity = calculateStringSimilarity(lineA, lineB);
        if (similarity >= 0.8) {
          this.chorusLineIndices.add(i);
          this.chorusLineIndices.add(j);
        }
      }
    }

    // 2. Assign dynamic scene to each line based on musicality/lyric metrics
    const sceneRotation: Exclude<SceneType, 'auto'>[] = ['drift', 'lineSweep', 'dotMorph', 'pulse'];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const wordCount = line.words.length;
      const duration = line.end - line.start;
      const nextLine = lines[i + 1];
      const gapToNext = nextLine ? Math.max(0, nextLine.start - line.end) : 4.0;
      const isChorus = this.chorusLineIndices.has(i);

      let chosen: Exclude<SceneType, 'auto'>;

      if (isChorus) {
        // High impact scenes for chorus
        chosen = i % 2 === 0 ? 'pulse' : 'dotMorph';
      } else if (wordCount <= 3 && duration < 2.5) {
        // Short punchy phrase
        chosen = 'pulse';
      } else if (wordCount >= 8) {
        // Long descriptive line
        chosen = 'drift';
      } else if (gapToNext > 1.8) {
        // Line leading into a pause/gap
        chosen = 'dotMorph';
      } else {
        // Balanced rhythmic line
        chosen = sceneRotation[i % sceneRotation.length];
      }

      this.lineSceneMap.set(i, chosen);
    }
  }

  /**
   * Retrieves the assigned scene for a given line index, respecting any manual override.
   */
  public getSceneForLine(
    lineIndex: number,
    manualOverride: SceneType = 'auto'
  ): Exclude<SceneType, 'auto'> {
    if (manualOverride !== 'auto') {
      return manualOverride;
    }

    return this.lineSceneMap.get(lineIndex) || 'drift';
  }

  public isChorusLine(lineIndex: number): boolean {
    return this.chorusLineIndices.has(lineIndex);
  }
}

