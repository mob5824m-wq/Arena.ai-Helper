/* Auto-continue: click "continue generating" / "read more" buttons automatically
 * until a response completes naturally (up to a safety cap per response).
 */
(function () {
  'use strict';
  const { settings, runtime, on, ui } = window.ArenaHelper;

  function attemptContinue() {
    if (!settings.autoContinue) return false;
    if (runtime.autoContinueClicksThisResponse >= (settings.autoContinueMaxClicks || 3)) return false;
    if (runtime.isAssistantResponding) return false;

    const btn = ui.findContinueButton();
    if (!btn) return false;

    // Avoid clicking the same "continue" twice — wait for DOM to change.
    const msgCount = (ui.findMessages() || []).length;
    if (msgCount === runtime.lastMessageCountAtContinue && runtime.autoContinueClicksThisResponse > 0) return false;
    runtime.lastMessageCountAtContinue = msgCount;

    runtime.autoContinueClicksThisResponse += 1;
    btn.click();
    return true;
  }

  function onResponseStarted() {
    runtime.autoContinueClicksThisResponse = 0;
    runtime.lastMessageCountAtContinue = 0;
  }

  function onResponseDone() {
    // Try to click continue buttons, with retries as new continue buttons may appear.
    let tries = 0;
    const loop = () => {
      tries++;
      if (tries > 6) return;
      if (runtime.isAssistantResponding) return; // already generating again
      const clicked = attemptContinue();
      if (clicked) return; // will re-fire response:started -> response:done when it's done
      setTimeout(loop, 1500);
    };
    setTimeout(loop, 800);
  }

  function attach() {
    on('response:started', onResponseStarted);
    on('response:done', onResponseDone);
  }

  window.ArenaHelper.features = window.ArenaHelper.features || {};
  window.ArenaHelper.features.continue = { attach };
})();
