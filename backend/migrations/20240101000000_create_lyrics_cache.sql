CREATE TABLE IF NOT EXISTS lyrics_cache (
    cache_key TEXT PRIMARY KEY,
    artist TEXT NOT NULL,
    title TEXT NOT NULL,
    duration_bucket INTEGER NOT NULL,
    found INTEGER NOT NULL,
    source TEXT NOT NULL,
    synced INTEGER NOT NULL,
    payload TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lyrics_cache_expires_at ON lyrics_cache(expires_at);

