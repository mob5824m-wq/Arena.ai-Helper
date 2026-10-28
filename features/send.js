/* Core auto-send feature.
 * When the assistant finishes and the Arena composer already has text, submit it.
 * Arena's current composer is a Tiptap/ProseMirror contenteditable div, so this
 * watches both native input events and editor DOM changes.
 */
(function () {
  'use strict';
  const { settings, runtime, on, emit, ui } = window.ArenaHelper;
  let watchedComposer = null;
  let composerObserver = null;

  function canSendNow() {
    if (!settings.autoSend) return false;
    if (runtime.isAssistantResponding) return false;
    if (runtime.captchaDetected) return false;
    if (Date.now() < runtime.sendCooldownUntil) return false;
    if (settings.stopAfterThis) return false;
    return true;
  }

  // Fire an event that lets queue.js (or other features) trim the input before send.
  function prepareForSend(input) {
    const evt = { input, text: ui.getInputText(input), cancel: false };
    emit('prompt:prepare', evt);
    return evt;
  }

  function tryAutoSend() {
    if (!canSendNow()) return false;
    const input = ui.findChatInput();
    if (!input) return false;
    let text = ui.getInputText(input).trim();
    if (!text) {
      runtime.lastSendHandledForText = '';
      return false;
    }
    if (text === runtime.lastSendHandledForText) return false;

    // Let queue.js split off queued items before we check the text.
    const prep = prepareForSend(input);
    if (prep.cancel) return false;
    text = ui.getInputText(input).trim();
    if (!text) return false;

    runtime.lastSendHandledForText = text;
    const delay = Math.max(0, Number(settings.autoSendDelayMs) || 0);
    runtime.sendCooldownUntil = Date.now() + delay + 1500;

    setTimeout(() => {
      if (!canSendNow()) {
        runtime.lastSendHandledForText = '';
        runtime.sendCooldownUntil = Date.now();
        return;
      }
      const composer = ui.findChatInput();
      if (!composer) return;
      const pendingText = ui.getInputText(composer).trim();
      if (!pendingText) return;
      // Final prepare handles a prompt that was turned into a queue while waiting.
      const prep2 = prepareForSend(composer);
      if (prep2.cancel) return;
      const finalText = ui.getInputText(composer).trim();
      if (!finalText) return;
      const sent = ui.submitInput(composer);
      if (sent) {
        emit('prompt:sent', { text: finalText });
        runtime.lastSendHandledForText = '';
      } else {
        runtime.lastSendHandledForText = '';
        runtime.sendCooldownUntil = Date.now();
      }
    }, delay);
    return true;
  }

  function scheduleAutoSend() {
    const composer = ui.findChatInput();
    if (!composer || !ui.getInputText(composer).trim()) return;
    clearTimeout(scheduleAutoSend.timer);
    scheduleAutoSend.timer = setTimeout(() => tryAutoSend(), 900);
  }

  function watchComposer() {
    const composer = ui.findChatInput();
    if (composer === watchedComposer) return;
    if (composerObserver) composerObserver.disconnect();
    watchedComposer = composer;
    composerObserver = null;
    if (!composer || !window.MutationObserver) return;
    composerObserver = new MutationObserver(() => {
      // ProseMirror changes can bypass the document-level input listener.
      if (!runtime.isAssistantResponding) scheduleAutoSend();
    });
    composerObserver.observe(composer, { childList: true, subtree: true, characterData: true });
  }

  // When a user types, debounce and try sending if idle. The same handler catches
  // input events dispatched by ui.setInputText for queue and quick-prompt inserts.
  function onInputActivity() {
    const { features } = window.ArenaHelper;
    if (features && features.scroll) features.scroll.schedule();
    watchComposer();
    if (!runtime.isAssistantResponding) scheduleAutoSend();
  }

  function checkExistingPrompt() {
    watchComposer();
    // Check the actual current composer, including a prompt typed while the model
    // was responding. This is intentionally periodic so an existing Tiptap value
    // cannot be missed if Arena did not emit an input event to the document.
    if (!runtime.isAssistantResponding) tryAutoSend();
  }

  function attach() {
    document.addEventListener('input', onInputActivity, true);
    watchComposer();
    setInterval(checkExistingPrompt, 1000);
    on('response:done', () => {
      watchComposer();
      setTimeout(tryAutoSend, 250);
    });
  }

  window.ArenaHelper.features = window.ArenaHelper.features || {};
  window.ArenaHelper.features.send = { tryAutoSend, attach, canSendNow, checkExistingPrompt };
})();
