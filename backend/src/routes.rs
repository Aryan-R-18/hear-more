use crate::cache::{CacheResult, LyricsCache};
use crate::cleaner::TitleCleaner;
use crate::lrclib::LrclibClient;
use crate::models::{LyricsQuery, LyricsResponse};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;
use std::sync::Arc;
use tracing::{info, warn};

pub struct AppState {
    pub cache: LyricsCache,
    pub lrclib: LrclibClient,
    pub cleaner: TitleCleaner,
}

pub async fn health_check() -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "service": "kinetic-lyrics-backend"
    }))
}

pub async fn get_lyrics(
    State(state): State<Arc<AppState>>,
    Query(query): Query<LyricsQuery>,
) -> Result<Json<LyricsResponse>, (StatusCode, Json<serde_json::Value>)> {
    let raw_title = match query.title {
        Some(t) if !t.trim().is_empty() => t.trim().to_string(),
        _ => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "error": "Missing required query parameter: 'title'"
                })),
            ));
        }
    };

    let raw_artist = query.artist.as_deref();

    // 1. Clean title and artist noise
    let cleaned = state.cleaner.clean(&raw_title, raw_artist);
    info!(
        "Processing lyrics request: cleaned title='{}', artist='{}', duration={:?}",
        cleaned.title, cleaned.artist, query.duration
    );

    // 2. Check SQLite cache
    if let Some(cached) = state.cache.get(&cleaned.artist, &cleaned.title, query.duration).await {
        match cached {
            CacheResult::Hit(lyrics) => {
                info!("Served lyrics from cache for '{} - {}'", cleaned.artist, cleaned.title);
                return Ok(Json(lyrics));
            }
            CacheResult::Miss => {
                info!("Served cached negative miss for '{} - {}'", cleaned.artist, cleaned.title);
                return Ok(Json(LyricsResponse {
                    found: false,
                    source: "lrclib".to_string(),
                    synced: false,
                    lines: vec![],
                    plain_text: None,
                }));
            }
        }
    }

    // 3. Fetch from LRCLIB
    match state.lrclib.fetch_lyrics(&cleaned.title, &cleaned.artist, query.duration).await {
        Ok(Some(lyrics)) => {
            info!("Found lyrics on LRCLIB for '{} - {}'", cleaned.artist, cleaned.title);
            let _ = state.cache.set_hit(&cleaned.artist, &cleaned.title, query.duration, &lyrics).await;
            Ok(Json(lyrics))
        }
        Ok(None) => {
            info!("Lyrics NOT found on LRCLIB for '{} - {}'", cleaned.artist, cleaned.title);
            let _ = state.cache.set_miss(&cleaned.artist, &cleaned.title, query.duration).await;
            Ok(Json(LyricsResponse {
                found: false,
                source: "lrclib".to_string(),
                synced: false,
                lines: vec![],
                plain_text: None,
            }))
        }
        Err(err) => {
            warn!("Upstream error querying LRCLIB: {}", err);
            Err((
                StatusCode::BAD_GATEWAY,
                Json(json!({
                    "error": "Failed to retrieve lyrics from upstream provider",
                    "details": err.to_string()
                })),
            ))
        }
    }
}

