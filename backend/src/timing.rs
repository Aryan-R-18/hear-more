use crate::models::{LyricLine, LyricWord};
use regex::Regex;

/// Estimates syllables in a word using English vowel group heuristics.
pub fn estimate_syllables(word: &str) -> usize {
    let clean: String = word
        .chars()
        .filter(|c| c.is_alphabetic())
        .collect::<String>()
        .to_lowercase();

    if clean.is_empty() || clean.len() <= 2 {
        return 1;
    }

    let vowel_regex = Regex::new(r"[aeiouy]{1,2}").unwrap();
    let matches = vowel_regex.find_iter(&clean).count();
    let mut syllables = if matches == 0 { 1 } else { matches };

    // Subtract silent 'e' at end
    if clean.ends_with('e') && !clean.ends_with("le") && !clean.ends_with("ee") && clean.len() > 2 {
        syllables = syllables.saturating_sub(1);
    }

    // Subtract 'ed' unless preceded by d or t
    if clean.ends_with("ed") && !clean.ends_with("ded") && !clean.ends_with("ted") && clean.len() > 3 {
        syllables = syllables.saturating_sub(1);
    }

    syllables.max(1)
}

/// Splits a line's duration across its words weighted by character length and syllable count,
/// leaving a 5% gap at the end of each line.
pub fn calculate_word_timings(
    line_text: &str,
    line_start: f64,
    line_end: f64,
    end_gap_ratio: f64,
) -> Vec<LyricWord> {
    let trimmed = line_text.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }

    let raw_words: Vec<&str> = trimmed.split_whitespace().collect();
    if raw_words.is_empty() {
        return Vec::new();
    }

    let total_duration = (line_end - line_start).max(0.0);
    if total_duration <= 0.0 {
        return raw_words
            .into_iter()
            .map(|w| LyricWord {
                text: w.to_string(),
                start: line_start,
                end: line_start,
            })
            .collect();
    }

    let gap = end_gap_ratio.clamp(0.0, 0.25);
    let active_duration = total_duration * (1.0 - gap);

    let weights: Vec<f64> = raw_words
        .iter()
        .map(|w| {
            let letters = w.chars().filter(|c| c.is_alphanumeric()).count() as f64;
            let syllables = estimate_syllables(w) as f64;
            (letters * 0.7 + syllables * 1.5).max(1.0)
        })
        .collect();

    let total_weight: f64 = weights.iter().sum();

    let mut current_time = line_start;
    let mut words = Vec::with_capacity(raw_words.len());

    for (i, word_text) in raw_words.iter().enumerate() {
        let weight = weights[i];
        let duration = (weight / total_weight) * active_duration;
        let start = current_time;
        let end = if i == raw_words.len() - 1 {
            line_start + active_duration
        } else {
            start + duration
        };

        words.push(LyricWord {
            text: word_text.to_string(),
            start: (start * 1000.0).round() / 1000.0,
            end: (end * 1000.0).round() / 1000.0,
        });

        current_time = end;
    }

    words
}

/// Parses a timestamp like [mm:ss.xx] or [mm:ss.xxx] into seconds.
pub fn parse_timestamp(ts: &str) -> Option<f64> {
    let parts: Vec<&str> = ts.split(':').collect();
    if parts.len() < 2 {
        return None;
    }
    let minutes: f64 = parts[0].trim().parse().ok()?;
    let seconds: f64 = parts[1].trim().parse().ok()?;
    Some(minutes * 60.0 + seconds)
}

/// Parses raw LRC string into structured LyricLines with precomputed word timings.
pub fn parse_lrc(lrc_content: &str) -> Vec<LyricLine> {
    let time_regex = Regex::new(r"\[(\d{1,2}:\d{2}(?:\.\d{1,3})?)\]").unwrap();
    let mut raw_items: Vec<(f64, String)> = Vec::new();

    for line in lrc_content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("[ti:") || trimmed.starts_with("[ar:") || trimmed.starts_with("[al:") || trimmed.starts_with("[offset:") {
            continue;
        }

        let mut timestamps = Vec::new();
        let mut last_idx = 0;

        for cap in time_regex.captures_iter(trimmed) {
            if let Some(m) = cap.get(1) {
                if let Some(sec) = parse_timestamp(m.as_str()) {
                    timestamps.push(sec);
                }
            }
            if let Some(full) = cap.get(0) {
                last_idx = full.end();
            }
        }

        if !timestamps.is_empty() {
            let lyric_text = trimmed[last_idx..].trim().to_string();
            for t in timestamps {
                raw_items.push((t, lyric_text.clone()));
            }
        }
    }

    raw_items.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));

    let mut result = Vec::with_capacity(raw_items.len());

    for i in 0..raw_items.len() {
        let (current_time, text) = &raw_items[i];
        let mut end = if i + 1 < raw_items.len() {
            raw_items[i + 1].0
        } else {
            *current_time + 4.0
        };

        if end <= *current_time {
            end = *current_time + 1.0;
        }

        let words = calculate_word_timings(text, *current_time, end, 0.05);

        result.push(LyricLine {
            start: (*current_time * 1000.0).round() / 1000.0,
            end: (end * 1000.0).round() / 1000.0,
            text: text.clone(),
            words,
        });
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_estimate_syllables() {
        assert_eq!(estimate_syllables("night"), 1);
        assert_eq!(estimate_syllables("make"), 1);
        assert!(estimate_syllables("shadows") >= 2);
        assert!(estimate_syllables("frequencies") >= 3);
    }

    #[test]
    fn test_calculate_word_timings_gap() {
        let words = calculate_word_timings("In the neon glow", 10.0, 14.0, 0.05);
        assert_eq!(words.len(), 4);
        assert_eq!(words[0].start, 10.0);
        // 4s total * 0.95 active = 3.8s -> ends at 13.8s
        assert!(words[3].end <= 13.81);
        assert!(words[3].end >= 13.75);
    }
}

