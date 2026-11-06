use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LyricWord {
    pub text: String,
    pub start: f64,
    pub end: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LyricLine {
    pub start: f64,
    pub end: f64,
    pub text: String,
    pub words: Vec<LyricWord>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LyricsResponse {
    pub found: bool,
    pub source: String,
    pub synced: bool,
    pub lines: Vec<LyricLine>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub plain_text: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LyricsQuery {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub duration: Option<f64>,
}

