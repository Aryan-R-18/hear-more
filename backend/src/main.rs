mod cache;
mod cleaner;
mod lrclib;
mod models;
mod routes;
mod timing;

use axum::{
    http::{header, HeaderValue, Method},
    routing::get,
    Router,
};
use cache::LyricsCache;
use cleaner::TitleCleaner;
use lrclib::LrclibClient;
use routes::{get_lyrics, health_check, AppState};
use std::sync::Arc;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::info;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing logger
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "kinetic_lyrics_backend=info,tower_http=info".into()),
        )
        .init();

    info!("Starting Kinetic Lyrics backend service...");

    // Initialize SQLite lyrics cache
    let db_path = "sqlite:lyrics_cache.db?mode=rwc";
    let cache = LyricsCache::new(db_path).await?;
    let lrclib = LrclibClient::new();
    let cleaner = TitleCleaner::new();

    let state = Arc::new(AppState {
        cache,
        lrclib,
        cleaner,
    });

    // Permissive CORS for localhost, 127.0.0.1, and chrome-extension://*
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::predicate(|origin: &HeaderValue, _| {
            let s = origin.as_bytes();
            s.starts_with(b"http://localhost")
                || s.starts_with(b"http://127.0.0.1")
                || s.starts_with(b"chrome-extension://")
        }))
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([header::CONTENT_TYPE, header::ACCEPT, header::AUTHORIZATION]);

    let app = Router::new()
        .route("/api/health", get(health_check))
        .route("/api/lyrics", get(get_lyrics))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = "0.0.0.0:8080";
    let listener = tokio::net::TcpListener::bind(addr).await?;
    info!("Server listening on http://localhost:8080");

    axum::serve(listener, app).await?;

    Ok(())
}

