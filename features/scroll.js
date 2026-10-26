/* Auto-scroll feature. Scrolls chat container to bottom on new messages.
 * - Pauses when the user manually scrolls up.
 * - Uses Arena's native "Scroll to bottom" floating button (aria-label="Scroll to bottom")
 *   as the authoritative signal for "user is away from bottom": while that button is
 *   visible in the DOM, auto-scroll is paused; when it disappears (user returns near
 *   the bottom, or we just clicked it), auto-scroll resumes.
 * - Resumes automatically when the user returns to the bottom.
 */
(function () {
  'use strict';
  const { settings, runtime, on, ui } = window.ArenaHelper;
  let chatContainer = null;
  let scheduled = false;
  let scrollListenerAttached = false;

  function ensureContainer() {
    if (!chatContainer || !document.contains(chatContainer)) {
      chatContainer = ui.findChatContainer();
      attachContainerScroll();
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

  function arenaScrollBtnVisible() {
    const b = ui.findArenaScrollToBottomButton();
    return !!(b && !b.disabled);
  }

  function run(smooth = true) {
    if (!settings.autoScroll) return;

    // Authoritative pause: if Arena is showing its own "Scroll to bottom" button,
    // the user is away from bottom. Honor that instead of fighting them.
    if (settings.scrollPauseOnManualScroll && arenaScrollBtnVisible()) {
      runtime.userScrolledUp = true;
      return;
    }

    // Secondary pause: our own scroll-position check (in case Arena's button isn't rendered yet)
    if (settings.scrollPauseOnManualScroll && runtime.userScrolledUp) return;

    // Click Arena's own scroll-bottom button if visible — it uses Arena's internal target.
    const nativeBtn = ui.findArenaScrollToBottomButton();
    if (nativeBtn && !nativeBtn.disabled) {
      runtime.userScrolledUp = false;
      nativeBtn.click();
      return;
    }
    const el = ensureContainer();
    if (el) {
      // If we're programmatically scrolling, we must be at the bottom afterwards.
      runtime.userScrolledUp = false;
      ui.scrollToBottom(el, smooth);
    } else {
      runtime.userScrolledUp = false;
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    }
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

  function attachContainerScroll() {
    if (scrollListenerAttached) return;
    const el = chatContainer;
    if (el && el !== document.body && el !== document.documentElement) {
      el.addEventListener('scroll', onScroll, { passive: true });
      scrollListenerAttached = true;
    }
  }

  function attach() {
    window.addEventListener('scroll', onScroll, { passive: true });
    ensureContainer();
    setTimeout(() => { ensureContainer(); }, 1500);
    setTimeout(() => { ensureContainer(); }, 5000);

    // Also watch for the native "scroll to bottom" button appearing/disappearing as
    // a strong signal to pause/resume auto-scroll.
    const btnObserver = new MutationObserver(() => {
      if (!settings.autoScroll) return;
      if (!settings.scrollPauseOnManualScroll) return;
      if (arenaScrollBtnVisible()) {
        runtime.userScrolledUp = true;
      } else {
        // Button disappeared — either we clicked it, or user scrolled to bottom.
        runtime.userScrolledUp = false;
        schedule();
      }
    });
    btnObserver.observe(document.body, { childList: true, subtree: true });
  }

  function forceScroll() {
    runtime.userScrolledUp = false;
    run(false);
  }

  on('response:started', () => { runtime.userScrolledUp = false; schedule(); });
  on('response:done', () => { runtime.userScrolledUp = false; run(false); });

  window.ArenaHelper.features = window.ArenaHelper.features || {};
  window.ArenaHelper.features.scroll = { schedule, run, forceScroll, attach };
})();
