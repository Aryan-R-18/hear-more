use crate::models::{LyricLine, LyricsResponse};
use crate::timing::parse_lrc;
use reqwest::Client;
use serde::Deserialize;
use std::time::Duration;
use tracing::{debug, info, warn};

const LRCLIB_BASE_URL: &str = "https://lrclib.net/api";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct LrclibTrack {
    pub id: Option<i64>,
    pub track_name: Option<String>,
    pub artist_name: Option<String>,
    pub album_name: Option<String>,
    pub duration: Option<f64>,
    pub instrumental: Option<bool>,
    pub plain_lyrics: Option<String>,
    pub synced_lyrics: Option<String>,
}

#[derive(Clone)]
pub struct LrclibClient {
    client: Client,
}

impl Default for LrclibClient {
    fn default() -> Self {
        Self::new()
    }
}

impl LrclibClient {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(6))
            .user_agent("KineticLyrics/1.0 (kinetic-lyrics-visualizer)")
            .build()
            .expect("Failed to build reqwest client");

        Self { client }
    }

    /// Fetches lyrics from LRCLIB: calls /api/get first, then falls back to /api/search
    pub async fn fetch_lyrics(
        &self,
        title: &str,
        artist: &str,
        duration: Option<f64>,
    ) -> Result<Option<LyricsResponse>, reqwest::Error> {
        info!(
            "Querying LRCLIB for title: '{}', artist: '{}', duration: '{:?}'",
            title, artist, duration
        );

        // 1. First attempt: exact match via /api/get
        if let Some(track) = self.try_get_exact(title, artist, duration).await? {
            if let Some(resp) = self.process_track_response(track) {
                return Ok(Some(resp));
            }
        }

        // 2. Fallback attempt: fuzzy search via /api/search
        debug!("Exact match not found on LRCLIB, falling back to /api/search...");
        if let Some(track) = self.try_search_fallback(title, artist, duration).await? {
            if let Some(resp) = self.process_track_response(track) {
                return Ok(Some(resp));
            }
        }

        Ok(None)
    }

    async fn try_get_exact(
        &self,
        title: &str,
        artist: &str,
        duration: Option<f64>,
    ) -> Result<Option<LrclibTrack>, reqwest::Error> {
        let mut query = vec![("track_name", title), ("artist_name", artist)];
        let dur_str;
        if let Some(d) = duration {
            if d > 0.0 {
                dur_str = d.round().to_string();
                query.push(("duration", &dur_str));
            }
        }

        let url = format!("{}/get", LRCLIB_BASE_URL);
        let resp = self.client.get(&url).query(&query).send().await?;

        if resp.status().is_success() {
            let track: LrclibTrack = resp.json().await?;
            return Ok(Some(track));
        }

        Ok(None)
    }

    async fn try_search_fallback(
        &self,
        title: &str,
        artist: &str,
        target_duration: Option<f64>,
    ) -> Result<Option<LrclibTrack>, reqwest::Error> {
        let search_query = if !artist.is_empty() {
            format!("{} {}", artist, title)
        } else {
            title.to_string()
        };

        let url = format!("{}/search", LRCLIB_BASE_URL);
        let resp = self
            .client
            .get(&url)
            .query(&[("q", &search_query)])
            .send()
            .await?;

        if !resp.status().is_success() {
            return Ok(None);
        }

        let tracks: Vec<LrclibTrack> = match resp.json().await {
            Ok(t) => t,
            Err(e) => {
                warn!("Failed to deserialize search results from LRCLIB: {}", e);
                return Ok(None);
            }
        };

        if tracks.is_empty() {
            return Ok(None);
        }

        // Score tracks: prefer synced lyrics, close duration (within ±3s), and title similarity
        let mut best_track: Option<LrclibTrack> = None;
        let mut highest_score = -100.0;

        for track in tracks {
            let mut score = 0.0;

            // Big bonus for synced lyrics
            let has_synced = track.synced_lyrics.as_ref().map(|s| !s.trim().is_empty()).unwrap_or(false);
            if has_synced {
                score += 50.0;
            }

            // Duration check within ±3.0s
            if let (Some(target), Some(track_dur)) = (target_duration, track.duration) {
                let diff = (target - track_dur).abs();
                if diff <= 3.5 {
                    score += 30.0 - (diff * 5.0);
                } else if diff > 10.0 {
                    score -= 20.0;
                }
            }

            // String match checks
            let title_lower = title.to_lowercase();
            let track_name_lower = track.track_name.as_deref().unwrap_or("").to_lowercase();
            if track_name_lower.contains(&title_lower) || title_lower.contains(&track_name_lower) {
                score += 20.0;
            }

            if score > highest_score {
                highest_score = score;
                best_track = Some(track);
            }
        }

        Ok(best_track)
    }

    fn process_track_response(&self, track: LrclibTrack) -> Option<LyricsResponse> {
        let has_synced = track.synced_lyrics.as_ref().map(|s| !s.trim().is_empty()).unwrap_or(false);
        let has_plain = track.plain_lyrics.as_ref().map(|s| !s.trim().is_empty()).unwrap_or(false);

        if has_synced {
            let raw_synced = track.synced_lyrics.unwrap();
            let lines: Vec<LyricLine> = parse_lrc(&raw_synced);

            return Some(LyricsResponse {
                found: true,
                source: "lrclib".to_string(),
                synced: true,
                lines,
                plain_text: track.plain_lyrics,
            });
        }

        if has_plain {
            return Some(LyricsResponse {
                found: true,
                source: "lrclib".to_string(),
                synced: false,
                lines: vec![],
                plain_text: track.plain_lyrics,
            });
        }

        None
    }
}

