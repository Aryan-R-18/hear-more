use crate::models::LyricsResponse;
use chrono::Utc;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use sqlx::Row;
use std::str::FromStr;
use tracing::{debug, info};

pub enum CacheResult {
    Hit(LyricsResponse),
    Miss,
}

#[derive(Clone)]
pub struct LyricsCache {
    pool: SqlitePool,
}

impl LyricsCache {
    pub async fn new(db_url: &str) -> Result<Self, sqlx::Error> {
        let connection_options = SqliteConnectOptions::from_str(db_url)?
            .create_if_missing(true);

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(connection_options)
            .await?;

        // Run migrations
        let migration_sql = include_str!("../migrations/20240101000000_create_lyrics_cache.sql");
        for statement in migration_sql.split(';') {
            let stmt = statement.trim();
            if !stmt.is_empty() {
                sqlx::query(stmt).execute(&pool).await?;
            }
        }
        info!("SQLite lyrics cache database initialized and migrations applied.");

        Ok(Self { pool })
    }

    /// Normalizes a string for deterministic cache keys
    pub fn normalize(input: &str) -> String {
        input
            .to_lowercase()
            .chars()
            .filter(|c| c.is_alphanumeric() || c.is_whitespace())
            .collect::<String>()
            .split_whitespace()
            .collect::<Vec<&str>>()
            .join(" ")
    }

    /// Buckets duration into 3-second intervals to absorb streaming duration variances
    pub fn duration_bucket(duration_sec: Option<f64>) -> i64 {
        match duration_sec {
            Some(d) if d > 0.0 => (d / 3.0).round() as i64,
            _ => 0,
        }
    }

    /// Builds a deterministic cache key
    pub fn build_cache_key(artist: &str, title: &str, duration_sec: Option<f64>) -> String {
        let norm_artist = Self::normalize(artist);
        let norm_title = Self::normalize(title);
        let bucket = Self::duration_bucket(duration_sec);
        format!("{}:{}:{}", norm_artist, norm_title, bucket)
    }

    pub async fn get(&self, artist: &str, title: &str, duration_sec: Option<f64>) -> Option<CacheResult> {
        let key = Self::build_cache_key(artist, title, duration_sec);
        let now = Utc::now().timestamp();

        let row = sqlx::query(
            "SELECT found, payload, expires_at FROM lyrics_cache WHERE cache_key = ? AND expires_at > ?"
        )
        .bind(&key)
        .bind(now)
        .fetch_optional(&self.pool)
        .await
        .ok()?;

        if let Some(r) = row {
            let found: i64 = r.try_get("found").unwrap_or(0);
            if found == 1 {
                if let Ok(payload_str) = r.try_get::<String, _>("payload") {
                    if let Ok(resp) = serde_json::from_str::<LyricsResponse>(&payload_str) {
                        debug!("Cache HIT for key: {}", key);
                        return Some(CacheResult::Hit(resp));
                    }
                }
            } else {
                debug!("Cache MISS (cached negative hit) for key: {}", key);
                return Some(CacheResult::Miss);
            }
        }

        None
    }

    pub async fn set_hit(
        &self,
        artist: &str,
        title: &str,
        duration_sec: Option<f64>,
        response: &LyricsResponse,
    ) -> Result<(), sqlx::Error> {
        let key = Self::build_cache_key(artist, title, duration_sec);
        let bucket = Self::duration_bucket(duration_sec);
        let now = Utc::now().timestamp();
        // 7 days TTL for hits
        let expires_at = now + 7 * 24 * 3600;
        let payload = serde_json::to_string(response).unwrap_or_default();
        let synced_val = if response.synced { 1i64 } else { 0i64 };

        sqlx::query(
            "INSERT OR REPLACE INTO lyrics_cache (cache_key, artist, title, duration_bucket, found, source, synced, payload, created_at, expires_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)"
        )
        .bind(&key)
        .bind(artist)
        .bind(title)
        .bind(bucket)
        .bind(&response.source)
        .bind(synced_val)
        .bind(&payload)
        .bind(now)
        .bind(expires_at)
        .execute(&self.pool)
        .await?;

        debug!("Cached positive hit for key: {}", key);
        Ok(())
    }

    pub async fn set_miss(
        &self,
        artist: &str,
        title: &str,
        duration_sec: Option<f64>,
    ) -> Result<(), sqlx::Error> {
        let key = Self::build_cache_key(artist, title, duration_sec);
        let bucket = Self::duration_bucket(duration_sec);
        let now = Utc::now().timestamp();
        // Shorter TTL for misses: 2 hours
        let expires_at = now + 2 * 3600;

        sqlx::query(
            "INSERT OR REPLACE INTO lyrics_cache (cache_key, artist, title, duration_bucket, found, source, synced, payload, created_at, expires_at) VALUES (?, ?, ?, ?, 0, 'lrclib', 0, NULL, ?, ?)"
        )
        .bind(&key)
        .bind(artist)
        .bind(title)
        .bind(bucket)
        .bind(now)
        .bind(expires_at)
        .execute(&self.pool)
        .await?;

        debug!("Cached negative miss for key: {}", key);
        Ok(())
    }
}
