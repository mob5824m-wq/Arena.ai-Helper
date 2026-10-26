/* Shared state + settings loaded from chrome.storage.
 * All feature files read from / write to window.ArenaHelper.
 */
(function () {
  'use strict';

  const defaults = Object.freeze({
    autoScroll: true,
    autoSend: true,
    scrollPauseOnManualScroll: true,
    autoSendDelayMs: 600,

    // v2 features
    multiQueueEnabled: true,
    queueDelimiter: '---',        // separates queued prompts (line before + after is just the delimiter line)
    autoContinue: true,
    autoContinueMaxClicks: 3,     // safety cap per response
    doneNotification: true,
    doneSound: true,
    autoFocus: true,
    stopAfterThis: false,         // one-shot: after current response finishes, do not send next
    showTimestamps: false,
    showCopyCode: true,
    closeProtect: true,
    showFloatingStatus: true
  });

  const settings = { ...defaults };

  // Runtime state (not persisted)
  const runtime = {
    userScrolledUp: false,
    isAssistantResponding: false,
    assistantJustFinished: false,
    sendCooldownUntil: 0,
    lastSendHandledForText: '',
    queuedPrompts: [],                 // array of strings after the current input
    autoContinueClicksThisResponse: 0,
    lastMessageCountAtContinue: 0,
    conversationStartTs: Date.now(),
    seenMessageIds: new WeakSet(),
    inIframe: window.top !== window.self,
    // Some features are chat-only (don't run in e2b app previews or iframes that don't have a chat input)
    hasChatUi: false
  };

  const listeners = []; // settings/runtime change listeners

  function onSettingsChange(fn) { listeners.push(fn); }

  function setSetting(key, value) {
    if (!(key in defaults)) return;
    settings[key] = value;
    try { chrome.storage.sync.set({ [key]: value }); } catch (e) {}
    for (const fn of listeners) fn(key, value);
  }

  // In-memory only override set by features (e.g. captcha pauses).
  // Notifies listeners the same way but does NOT persist.
  function overrideSettingTemp(key, value) {
    if (!(key in defaults)) return;
    settings[key] = value;
    for (const fn of listeners) fn(key, value);
  }

  function loadSettings() {
    try {
      chrome.storage.sync.get(defaults, (items) => {
        Object.assign(settings, items);
        for (const fn of listeners) fn('__all__', settings);
      });
    } catch (e) { /* ignore */ }
  }

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      for (const key in changes) {
        if (key in defaults) {
          settings[key] = changes[key].newValue;
          for (const fn of listeners) fn(key, settings[key]);
        }
      }
    });
  } catch (e) { /* ignore */ }

  // Lightweight pub/sub for events fired across features (e.g. "response:done")
  const eventListeners = new Map();
  function on(event, fn) {
    if (!eventListeners.has(event)) eventListeners.set(event, new Set());
    eventListeners.get(event).add(fn);
  }
  function off(event, fn) {
    const set = eventListeners.get(event);
    if (set) set.delete(fn);
  }
  function emit(event, payload) {
    const set = eventListeners.get(event);
    if (!set) return;
    for (const fn of Array.from(set)) {
      try { fn(payload); } catch (e) { console.error('[Arena.ai Helper] event handler error', event, e); }
    }
  }

  loadSettings();

  window.ArenaHelper = {
    defaults,
    settings,
    runtime,
    setSetting,
    overrideSettingTemp,
    onSettingsChange,
    on, off, emit
  };
})();
