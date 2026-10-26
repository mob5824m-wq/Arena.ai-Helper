/* Auto-scroll feature. Scrolls chat container to bottom on new messages.
 * Pauses when user scrolls up; resumes when they return to the bottom.
 */
(function () {
  'use strict';
  const { settings, runtime, on, ui } = window.ArenaHelper;
  let chatContainer = null;
  let scheduled = false;

  function ensureContainer() {
    if (!chatContainer || !document.contains(chatContainer)) {
      chatContainer = ui.findChatContainer();
    }
    return chatContainer;
  }

  function schedule() {
    if (!settings.autoScroll) return;
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      run();
    });
  }

  function run(smooth = true) {
    if (!settings.autoScroll) return;
    if (settings.scrollPauseOnManualScroll && runtime.userScrolledUp) return;
    // If Arena's own "Scroll to bottom" floating button is visible, click it — that's
    // the most reliable way (it knows the exact target offset and un-pauses Arena's
    // own auto-scroll behavior). Only click it once per tick to avoid fighting the user.
    const nativeBtn = ui.findArenaScrollToBottomButton();
    if (nativeBtn && !nativeBtn.disabled) {
      nativeBtn.click();
      return;
    }
    const el = ensureContainer();
    ui.scrollToBottom(el, smooth);
  }

  function onScroll() {
    const el = ensureContainer();
    const target = el && el !== document.body ? el : null;
    if (ui.isNearBottom(target)) {
      runtime.userScrolledUp = false;
      schedule();
    } else {
      const nearTop = target ? target.scrollTop < 30 : (window.scrollY || 0) < 30;
      if (!nearTop) runtime.userScrolledUp = true;
    }
  }

  function attach() {
    window.addEventListener('scroll', onScroll, { passive: true });
    const attachToEl = () => {
      const el = ensureContainer();
      if (el && el !== document.body && el !== document.documentElement) {
        el.addEventListener('scroll', onScroll, { passive: true });
      }
    };
    attachToEl();
    setTimeout(attachToEl, 1500);
    setTimeout(attachToEl, 5000);
  }

  // Public API used by other features (e.g. when a new queued prompt is sent, force scroll)
  function forceScroll() {
    runtime.userScrolledUp = false;
    run(false);
  }

  on('response:started', () => { runtime.userScrolledUp = false; schedule(); });
  on('response:done', () => { runtime.userScrolledUp = false; run(false); });

  window.ArenaHelper.features = window.ArenaHelper.features || {};
  window.ArenaHelper.features.scroll = { schedule, run, forceScroll, attach };
})();
