import {
  PlayerState,
  ExtensionMessage,
  DEFAULT_EXTENSION_SETTINGS,
  ExtensionSettings
} from '@kinetic-lyrics/shared';

interface TabPlaybackInfo {
  tabId: number;
  state: PlayerState;
  lastUpdated: number;
}

// Active media playback state tracked across tabs
let activePlayback: TabPlaybackInfo | null = null;
const allMediaTabs = new Map<number, TabPlaybackInfo>();

/**
 * Broadcasts message to all extension views (sidepanel, viewer tab, options, etc.)
 */
function broadcastMessage(message: ExtensionMessage): void {
  chrome.runtime.sendMessage(message, () => {
    // Ignore error if no viewer is currently listening
    if (chrome.runtime.lastError) {
      // no-op
    }
  });
}

/**
 * Configures Side Panel behavior on extension install or startup
 */
function setupSidePanel(): void {
  if (chrome.sidePanel && typeof chrome.sidePanel.setPanelBehavior === 'function') {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((err) => console.warn('SidePanel behavior configuration failed:', err));
  }
}

chrome.runtime.onInstalled.addListener(() => {
  setupSidePanel();

  // Initialize default settings in chrome.storage.sync if not already present
  chrome.storage.sync.get(['backendUrl', 'offsetMs', 'defaultScene', 'themeKey'], (items) => {
    const defaults: Partial<ExtensionSettings> = {};
    if (!items.backendUrl) defaults.backendUrl = DEFAULT_EXTENSION_SETTINGS.backendUrl;
    if (items.offsetMs === undefined) defaults.offsetMs = DEFAULT_EXTENSION_SETTINGS.offsetMs;
    if (!items.defaultScene) defaults.defaultScene = DEFAULT_EXTENSION_SETTINGS.defaultScene;
    if (!items.themeKey) defaults.themeKey = DEFAULT_EXTENSION_SETTINGS.themeKey;

    if (Object.keys(defaults).length > 0) {
      chrome.storage.sync.set(defaults);
    }
  });
});

chrome.runtime.onStartup.addListener(() => {
  setupSidePanel();
});

// Fallback action click handler in case sidePanel API is not available or clicked
chrome.action.onClicked.addListener(async (tab) => {
  if (chrome.sidePanel && typeof chrome.sidePanel.open === 'function' && tab.windowId) {
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId });
      return;
    } catch {
      // Fall through to tab opening
    }
  }

  // Fallback: Open full-tab viewer
  chrome.tabs.create({
    url: chrome.runtime.getURL('viewer.html')
  });
});

// Listen for messages from content scripts and viewer
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  switch (message.type) {
    case 'PLAYER_STATE_UPDATE': {
      if (!message.state || tabId === undefined) break;

      const now = Date.now();
      const tabInfo: TabPlaybackInfo = {
        tabId,
        state: message.state,
        lastUpdated: now
      };

      allMediaTabs.set(tabId, tabInfo);

      // Arbitration rule:
      // 1. If this tab is currently playing, it immediately wins active playback
      // 2. If this tab is the current active tab, update its state
      // 3. Otherwise, if current active tab is not playing and this tab is newer, switch
      if (
        message.state.playing ||
        !activePlayback ||
        activePlayback.tabId === tabId ||
        (!activePlayback.state.playing && now >= activePlayback.lastUpdated)
      ) {
        activePlayback = tabInfo;
        broadcastMessage({
          type: 'PLAYER_STATE_UPDATE',
          state: activePlayback.state,
          tabId
        });
      }
      break;
    }

    case 'GET_PLAYER_STATE': {
      sendResponse({
        state: activePlayback ? activePlayback.state : null
      });
      return false;
    }

    case 'GET_SETTINGS': {
      chrome.storage.sync.get(
        ['backendUrl', 'offsetMs', 'defaultScene', 'themeKey'],
        (items) => {
          sendResponse({
            settings: {
              backendUrl: items.backendUrl || DEFAULT_EXTENSION_SETTINGS.backendUrl,
              offsetMs: items.offsetMs ?? DEFAULT_EXTENSION_SETTINGS.offsetMs,
              defaultScene: items.defaultScene || DEFAULT_EXTENSION_SETTINGS.defaultScene,
              themeKey: items.themeKey || DEFAULT_EXTENSION_SETTINGS.themeKey
            }
          });
        }
      );
      return true; // async response
    }

    case 'SAVE_SETTINGS': {
      if (message.settings) {
        chrome.storage.sync.set(message.settings, () => {
          sendResponse({ success: true });
        });
        return true;
      }
      break;
    }

    default:
      break;
  }

  return false;
});

// Clean up when media tab is closed
chrome.tabs.onRemoved.addListener((closedTabId) => {
  allMediaTabs.delete(closedTabId);

  if (activePlayback && activePlayback.tabId === closedTabId) {
    // Find another playing tab if available
    let nextTab: TabPlaybackInfo | null = null;
    for (const info of allMediaTabs.values()) {
      if (info.state.playing) {
        nextTab = info;
        break;
      } else if (!nextTab || info.lastUpdated > nextTab.lastUpdated) {
        nextTab = info;
      }
    }

    activePlayback = nextTab;
    broadcastMessage({
      type: 'PLAYER_STATE_UPDATE',
      state: activePlayback ? activePlayback.state : null,
      tabId: activePlayback ? activePlayback.tabId : undefined
    });
  }
});

