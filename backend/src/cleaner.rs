use regex::Regex;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CleanedTrack {
    pub artist: String,
    pub title: String,
}

pub struct TitleCleaner {
    noise_regex: Regex,
    featured_regex: Regex,
    topic_regex: Regex,
    vevo_regex: Regex,
    whitespace_regex: Regex,
}

impl Default for TitleCleaner {
    fn default() -> Self {
        Self::new()
    }
}

impl TitleCleaner {
    pub fn new() -> Self {
        // Match bracketed/parenthesized tags like (Official Video), [HD], (Lyrics), (Official Video Remastered), (Official MV), etc.
        let noise_token = r"(?:official\s+(?:music\s+)?(?:video|mv)|official\s+audio|official\s+visualizer|visualizer|official\s+lyric\s+video|lyric\s+video|lyrics|audio|video|clip\s+officiel|mv|hd|hq|4k(?:\s*60fps)?|remaster(?:ed)?(?:\s*\d{4})?|\d{4}\s*remaster|live(?:\s+(?:at|in)[^)\]\}]+)?|explicit|clean\s+version|full\s+album|stream|prod\.[^()\[\]{}]+)";
        let noise_pattern = format!(r"(?i)[\(\[\{{]\s*(?:{}\s*[\s/|\-]*)+[\)\]\}}]", noise_token);

        // Match featuring artists: feat. X, ft. X, featuring X (in or out of brackets)
        let featured_pattern = r"(?i)(?:[\(\[\{]\s*)?\b(?:feat|ft|featuring)\b\.?\s+([^()\[\]{}]+)[\)\]\}]?";

        let topic_pattern = r"(?i)\s*-\s*topic\s*$";
        let vevo_pattern = r"(?i)vevo$";
        let whitespace_pattern = r"\s{2,}";

        Self {
            noise_regex: Regex::new(&noise_pattern).unwrap(),
            featured_regex: Regex::new(featured_pattern).unwrap(),
            topic_regex: Regex::new(topic_pattern).unwrap(),
            vevo_regex: Regex::new(vevo_pattern).unwrap(),
            whitespace_regex: Regex::new(whitespace_pattern).unwrap(),
        }
    }

    /// Strips emojis from a string
    fn remove_emojis(input: &str) -> String {
        input
            .chars()
            .filter(|&c| {
                let u = c as u32;
                !(
                    (0x1F600..=0x1F64F).contains(&u) || // Emoticons
                    (0x1F300..=0x1F5FF).contains(&u) || // Misc Symbols & Pictographs
                    (0x1F680..=0x1F6FF).contains(&u) || // Transport & Map
                    (0x1F700..=0x1F77F).contains(&u) || // Alchemical
                    (0x1F780..=0x1F7FF).contains(&u) || // Geometric
                    (0x1F800..=0x1F8FF).contains(&u) || // Supplemental Arrows
                    (0x1F900..=0x1F9FF).contains(&u) || // Supplemental Symbols
                    (0x1FA00..=0x1FA6F).contains(&u) || // Chess / symbols
                    (0x1FA70..=0x1FAFF).contains(&u) || // Symbols extended
                    (0x2600..=0x26FF).contains(&u)   || // Misc symbols
                    (0x2700..=0x27BF).contains(&u)      // Dingbats
                )
            })
            .collect()
    }

    /// Cleans artist name (strips '- Topic', 'VEVO', extra punctuation, featured artists)
    pub fn clean_artist(&self, raw_artist: &str) -> String {
        let mut artist = Self::remove_emojis(raw_artist);
        artist = self.topic_regex.replace(&artist, "").to_string();
        artist = self.featured_regex.replace_all(&artist, "").to_string();

        if let Some(caps) = self.vevo_regex.captures(&artist) {
            let vevo_match = caps.get(0).unwrap();
            let name_part = &artist[..vevo_match.start()].trim();
            if !name_part.is_empty() {
                artist = name_part.to_string();
            }
        }

        artist = artist.trim_matches(|c: char| c == '-' || c == '|' || c == '/' || c == '"' || c == '\'' || c.is_whitespace()).to_string();
        self.whitespace_regex.replace_all(&artist, " ").trim().to_string()
    }

    /// Cleans and separates raw title and optional artist into normalized title and artist
    pub fn clean(&self, raw_title: &str, raw_artist: Option<&str>) -> CleanedTrack {
        let mut title = Self::remove_emojis(raw_title);
        let mut artist = raw_artist.map(|a| self.clean_artist(a)).unwrap_or_default();

        // 1. Check if title is in "Artist - Song" format and either artist is generic or matches parsed artist
        let is_artist_generic = artist.is_empty()
            || artist.eq_ignore_ascii_case("youtube")
            || artist.eq_ignore_ascii_case("topic")
            || artist.eq_ignore_ascii_case("various artists");

        let has_separator = title.contains(" - ") || title.contains(" – ") || title.contains(" — ");
        if has_separator {
            let sep = if title.contains(" - ") {
                " - "
            } else if title.contains(" – ") {
                " – "
            } else {
                " — "
            };

            let parts: Vec<&str> = title.splitn(2, sep).collect();
            if parts.len() == 2 {
                let parsed_artist = parts[0].trim();
                let parsed_title = parts[1].trim();

                if !parsed_artist.is_empty() && !parsed_title.is_empty() {
                    let cleaned_parsed_artist = self.clean_artist(parsed_artist);
                    let parsed_no_ws: String = cleaned_parsed_artist.chars().filter(|c| !c.is_whitespace()).collect();
                    let artist_no_ws: String = artist.chars().filter(|c| !c.is_whitespace()).collect();

                    if is_artist_generic {
                        artist = cleaned_parsed_artist;
                        title = parsed_title.to_string();
                    } else if parsed_no_ws.eq_ignore_ascii_case(&artist_no_ws) {
                        if cleaned_parsed_artist.len() > artist.len() {
                            artist = cleaned_parsed_artist;
                        }
                        title = parsed_title.to_string();
                    }
                }
            }
        }

        // 2. Remove noise patterns like (Official Video), [HD], (Lyrics)
        title = self.noise_regex.replace_all(&title, " ").to_string();

        // 3. Extract and remove featured artist info from title
        if let Some(caps) = self.featured_regex.captures(&title) {
            let featured_artist = caps.get(1).map(|m| m.as_str().trim()).unwrap_or("");
            if !featured_artist.is_empty() && !artist.is_empty() && !artist.contains(featured_artist) {
                // If artist doesn't have it, we keep main artist clean
            }
            title = self.featured_regex.replace_all(&title, "").to_string();
        }

        // 4. Strip leftover unclosed brackets, quotes, or trailing punctuation
        title = title.replace("()", "").replace("[]", "").replace("{}", "");
        title = title.trim_matches(|c: char| c == '-' || c == '|' || c == '/' || c == ':' || c == '"' || c == '\'' || c.is_whitespace()).to_string();

        // 5. Clean whitespace
        title = self.whitespace_regex.replace_all(&title, " ").trim().to_string();
        artist = self.whitespace_regex.replace_all(&artist, " ").trim().to_string();

        CleanedTrack { artist, title }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_title_cleaner_20_messy_titles() {
        let cleaner = TitleCleaner::new();

        let cases = vec![
            // 1. YouTube title with Artist - Song and Official Video
            ("The Weeknd - Blinding Lights (Official Video)", None, "The Weeknd", "Blinding Lights"),
            // 2. Bracketed HD and Lyrics
            ("Dua Lipa - Levitating [Official Lyric Video] [HD]", None, "Dua Lipa", "Levitating"),
            // 3. Featured artist in title
            ("Calvin Harris - One Kiss (feat. Dua Lipa) (Official Audio)", None, "Calvin Harris", "One Kiss"),
            // 4. Feat without parentheses
            ("Major Lazer ft. Justin Bieber - Cold Water", None, "Major Lazer", "Cold Water"),
            // 5. Emojis and VEVO channel
            ("🔥 Queen - Bohemian Rhapsody (Official Video Remastered) 🎸", Some("QueenVEVO"), "Queen", "Bohemian Rhapsody"),
            // 6. Topic channel name
            ("Get Lucky", Some("Daft Punk - Topic"), "Daft Punk", "Get Lucky"),
            // 7. Visualizer tag
            ("Gorillaz - Feel Good Inc. (Official Visualizer)", None, "Gorillaz", "Feel Good Inc."),
            // 8. 4K 60FPS tag
            ("Rick Astley - Never Gonna Give You Up (4K 60FPS Remastered)", None, "Rick Astley", "Never Gonna Give You Up"),
            // 9. En dash separator
            ("Coldplay – Viva La Vida (Live at Wembley)", None, "Coldplay", "Viva La Vida"),
            // 10. Em dash separator
            ("Imagine Dragons — Radioactive (Official Music Video)", None, "Imagine Dragons", "Radioactive"),
            // 11. Clip Officiel (French)
            ("Stromae - Papaoutai (Clip Officiel)", None, "Stromae", "Papaoutai"),
            // 12. Korean MV tag
            ("BTS (방탄소년단) - Dynamite (Official MV)", None, "BTS (방탄소년단)", "Dynamite"),
            // 13. Quotes inside title
            ("Eminem - \"Lose Yourself\" (Audio)", None, "Eminem", "Lose Yourself"),
            // 14. Extra whitespace and symbols
            ("  Arctic Monkeys   -   Do I Wanna Know?   (Official Video)  ", None, "Arctic Monkeys", "Do I Wanna Know?"),
            // 15. Explicit tag in brackets
            ("Kendrick Lamar - HUMBLE. [Explicit]", None, "Kendrick Lamar", "HUMBLE."),
            // 16. Clean version tag
            ("Post Malone - Circles (Clean Version)", None, "Post Malone", "Circles"),
            // 17. Featuring with dot: ft.
            ("DJ Snake - Taki Taki ft. Selena Gomez, Ozuna, Cardi B", None, "DJ Snake", "Taki Taki"),
            // 18. Separate artist passed in, title with noise
            ("Starboy (Official Music Video)", Some("The Weeknd"), "The Weeknd", "Starboy"),
            // 19. Remastered year
            ("Pink Floyd - Comfortably Numb (2011 Remaster)", None, "Pink Floyd", "Comfortably Numb"),
            // 20. Live performance with venue
            ("Radiohead - Creep (Live at Glastonbury)", None, "Radiohead", "Creep"),
            // 21. Multiple emojis with VEVO and ft
            ("Ariana Grande - 7 rings 💍 ft. 2 Chainz (Official Video)", Some("ArianaGrandeVEVO"), "Ariana Grande", "7 rings"),
        ];

        for (raw_title, raw_artist, expected_artist, expected_title) in cases {
            let result = cleaner.clean(raw_title, raw_artist);
            assert_eq!(
                result.artist, expected_artist,
                "Artist mismatch for raw_title: '{}', raw_artist: '{:?}'. Got '{}', expected '{}'",
                raw_title, raw_artist, result.artist, expected_artist
            );
            assert_eq!(
                result.title, expected_title,
                "Title mismatch for raw_title: '{}'. Got '{}', expected '{}'",
                raw_title, result.title, expected_title
            );
        }
    }
}

