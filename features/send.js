/* Core auto-send feature.
 * When the assistant finishes and there is text in the box (or the queue has been
 * populated by the queue module), submit it.
 */
(function () {
  'use strict';
  const { settings, runtime, on, emit, ui } = window.ArenaHelper;

  function canSendNow() {
    if (!settings.autoSend) return false;
    if (runtime.isAssistantResponding) return false;
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
    if (!text) { runtime.lastSendHandledForText = ''; return false; }
    if (text === runtime.lastSendHandledForText) return false;

    // Let queue module split off queued items before we check the text.
    const prep = prepareForSend(input);
    if (prep.cancel) return false;
    text = ui.getInputText(input).trim();
    if (!text) return false;

    runtime.lastSendHandledForText = text;
    const delay = Math.max(0, settings.autoSendDelayMs || 0);
    runtime.sendCooldownUntil = Date.now() + delay + 1500;

    setTimeout(() => {
      if (!canSendNow()) {
        runtime.lastSendHandledForText = '';
        runtime.sendCooldownUntil = Date.now();
        return;
      }
      const inp = ui.findChatInput();
      if (!inp) return;
      const t = ui.getInputText(inp).trim();
      if (!t) return;
      // Final prepare (queue might still have items)
      const prep2 = prepareForSend(inp);
      if (prep2.cancel) return;
      const ok = ui.submitInput(inp);
      if (ok) {
        emit('prompt:sent', { text: t });
        runtime.lastSendHandledForText = '';
      }
    }, delay);
    return true;
  }

  // When user types, debounce and try sending if idle.
  function onInputActivity() {
    const { features } = window.ArenaHelper;
    if (features && features.scroll) features.scroll.schedule();
    if (!runtime.isAssistantResponding) {
      clearTimeout(onInputActivity._t);
      onInputActivity._t = setTimeout(() => tryAutoSend(), 1200);
    }
  }

  function attach() {
    document.addEventListener('input', onInputActivity, true);
    on('response:done', () => {
      setTimeout(() => tryAutoSend(), 250);
    });
  }

  window.ArenaHelper.features = window.ArenaHelper.features || {};
  window.ArenaHelper.features.send = { tryAutoSend, attach, canSendNow };
})();
