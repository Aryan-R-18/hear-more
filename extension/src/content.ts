import { PlayerState, ExtensionMessage } from '@kinetic-lyrics/shared';

// Track current media element and listeners
let currentMediaElement: HTMLMediaElement | null = null;
let lastSentState: PlayerState | null = null;
let heartbeatInterval: number | null = null;

/**
 * Attempts to find the active video or audio element on the page.
 */
function findActiveMediaElement(): HTMLMediaElement | null {
  const mediaElements = Array.from(document.querySelectorAll<HTMLMediaElement>('video, audio'));

  if (mediaElements.length === 0) {
    return null;
  }

  // 1. Prefer playing element
  const playingElement = mediaElements.find(
    (el) => !el.paused && el.currentTime > 0 && !el.ended && el.readyState > 1
  );
  if (playingElement) return playingElement;

  // 2. Prefer element with longest duration or active src
  const withSrc = mediaElements.filter((el) => Boolean(el.currentSrc || el.src));
  if (withSrc.length > 0) {
    withSrc.sort((a, b) => (b.duration || 0) - (a.duration || 0));
    return withSrc[0];
  }

  return mediaElements[0];
}

/**
 * Extracts metadata for the current track.
 * Primary: navigator.mediaSession.metadata
 * Fallbacks: DOM selectors for YouTube, YouTube Music, Spotify Web
 */
function extractMetadata(): { title: string; artist: string } {
  // 1. Primary source: navigator.mediaSession
  if (navigator.mediaSession?.metadata) {
    const meta = navigator.mediaSession.metadata;
    const title = meta.title?.trim();
    const artist = meta.artist?.trim();
    if (title) {
      return {
        title,
        artist: artist || ''
      };
    }
  }

  const hostname = window.location.hostname;

  // 2. YouTube Music fallback
  if (hostname.includes('music.youtube.com')) {
    const titleEl = document.querySelector('ytmusic-player-bar .title.ytmusic-player-bar, ytmusic-player-bar .title, .ytmusic-player-bar.title');
    const artistEl = document.querySelector('ytmusic-player-bar .byline.ytmusic-player-bar a, ytmusic-player-bar .byline a');
    const title = titleEl?.textContent?.trim() || '';
    const artist = artistEl?.textContent?.trim() || '';
    if (title) return { title, artist };
  }

  // 3. YouTube Main fallback
  if (hostname.includes('youtube.com')) {
    const titleEl = document.querySelector(
      'h1.ytd-watch-metadata yt-formatted-string, h1.title yt-formatted-string, #title h1 yt-formatted-string'
    );
    const artistEl = document.querySelector(
      '#upload-info ytd-channel-name yt-formatted-string a, #channel-name a, ytd-video-owner-renderer .ytd-channel-name'
    );

    let title = titleEl?.textContent?.trim() || '';
    if (!title) {
      // Fallback from document.title
      title = document.title.replace(/\s*-\s*YouTube\s*$/i, '').trim();
    }
    const artist = artistEl?.textContent?.trim() || '';
    if (title) return { title, artist };
  }

  // 4. Spotify Web fallback
  if (hostname.includes('spotify.com')) {
    const titleEl = document.querySelector(
      '[data-testid="context-item-info-title"] a, [data-testid="now-playing-widget"] [data-testid="context-item-info-title"], [data-testid="track-info-name"]'
    );
    const artistEl = document.querySelector(
      '[data-testid="context-item-info-subtitles"] a, [data-testid="context-item-info-artist"], [data-testid="track-info-artists"]'
    );

    const title = titleEl?.textContent?.trim() || '';
    const artist = artistEl?.textContent?.trim() || '';
    if (title) return { title, artist };
  }

  // Final generic document.title fallback
  return {
    title: document.title.trim(),
    artist: ''
  };
}

/**
 * Builds the current PlayerState snapshot.
 */
function getPlayerState(): PlayerState | null {
  const media = findActiveMediaElement();
  const { title, artist } = extractMetadata();

  // If no title is found or title is generic page title without media, return null
  if (!title || (!media && !title)) {
    return null;
  }

  const duration = media?.duration && !isNaN(media.duration) && isFinite(media.duration) ? media.duration : 0;
  const currentTime = media?.currentTime && !isNaN(media.currentTime) ? media.currentTime : 0;
  const isPlaying = media ? !media.paused && !media.ended : false;
  const rate = media?.playbackRate || 1.0;

  return {
    title,
    artist,
    duration,
    positionMs: Math.round(currentTime * 1000),
    playing: isPlaying,
    rate,
    timestamp: Date.now()
  };
}

/**
 * Sends a PlayerState update message to background.ts.
 */
function sendStateUpdate(force = false): void {
  const currentState = getPlayerState();
  if (!currentState) return;

  if (!force && lastSentState) {
    const trackChanged =
      currentState.title !== lastSentState.title || currentState.artist !== lastSentState.artist;
    const playChanged = currentState.playing !== lastSentState.playing;
    const rateChanged = currentState.rate !== lastSentState.rate;
    const positionDiff = Math.abs(currentState.positionMs - lastSentState.positionMs);

    // If nothing noticeable changed and position matches expected timeline (within 2s), skip
    if (!trackChanged && !playChanged && !rateChanged && positionDiff < 1500) {
      return;
    }
  }

  lastSentState = currentState;

  const message: ExtensionMessage = {
    type: 'PLAYER_STATE_UPDATE',
    state: currentState
  };

  try {
    chrome.runtime.sendMessage(message, () => {
      // Ignore errors when background script is sleeping or reloading
      if (chrome.runtime.lastError) {
        // no-op
      }
    });
  } catch {
    // Context may be invalidated if extension reloaded
  }
}

/**
 * Binds event listeners to the media element.
 */
function attachMediaListeners(media: HTMLMediaElement): void {
  if (currentMediaElement === media) return;

  currentMediaElement = media;

  const events: (keyof HTMLMediaElementEventMap)[] = [
    'play',
    'pause',
    'playing',
    'seeked',
    'ratechange',
    'durationchange',
    'loadedmetadata',
    'ended'
  ];

  events.forEach((eventName) => {
    media.addEventListener(eventName, () => {
      sendStateUpdate(true);
    });
  });

  // Handle immediate state
  sendStateUpdate(true);
}

/**
 * Initializes observers and event listeners.
 */
function init(): void {
  // 1. Initial media detection
  const media = findActiveMediaElement();
  if (media) {
    attachMediaListeners(media);
  }

  // 2. Watch for dynamic media elements inserted into DOM
  const observer = new MutationObserver(() => {
    const newMedia = findActiveMediaElement();
    if (newMedia && newMedia !== currentMediaElement) {
      attachMediaListeners(newMedia);
    }

    // Also send update if title or metadata changed
    const { title, artist } = extractMetadata();
    if (lastSentState && (title !== lastSentState.title || artist !== lastSentState.artist)) {
      sendStateUpdate(true);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'class', 'aria-label']
  });

  // 3. YouTube SPA navigation events
  window.addEventListener('yt-navigate-finish', () => {
    setTimeout(() => {
      const el = findActiveMediaElement();
      if (el) attachMediaListeners(el);
      sendStateUpdate(true);
    }, 500);
  });

  window.addEventListener('yt-page-data-updated', () => {
    setTimeout(() => {
      sendStateUpdate(true);
    }, 300);
  });

  // 4. Popstate / hashchange fallback for SPAs
  window.addEventListener('popstate', () => {
    setTimeout(() => sendStateUpdate(true), 500);
  });

  // 5. Heartbeat every 1s (1000ms) to correct clock drift during continuous playback
  if (heartbeatInterval !== null) {
    clearInterval(heartbeatInterval);
  }
  heartbeatInterval = window.setInterval(() => {
    const state = getPlayerState();
    if (state && state.playing) {
      sendStateUpdate(true);
    }
  }, 1000);

  // 6. Listen for state queries from background or popup
  chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    if (message.type === 'GET_PLAYER_STATE') {
      const state = getPlayerState();
      sendResponse({ state });
    }
    return true;
  });

  // Initial trigger
  sendStateUpdate(true);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
