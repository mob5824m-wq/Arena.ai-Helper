/* Auto-focus the input after each response and after sending a prompt. */
(function () {
  'use strict';
  const { settings, on, ui } = window.ArenaHelper;

  function focusInput(delay = 100) {
    if (!settings.autoFocus) return;
    setTimeout(() => {
      if (!settings.autoFocus) return;
      const inp = ui.findChatInput();
      if (!inp) return;
      try {
        inp.focus();
        // If it's a textarea, place caret at end.
        if (inp.tagName === 'TEXTAREA') {
          const len = inp.value.length;
          inp.setSelectionRange(len, len);
        }
      } catch (e) { /* ignore */ }
    }, delay);
  }

  function attach() {
    on('response:done', () => focusInput(200));
    on('prompt:sent', () => focusInput(300));
    // First-load focus
    setTimeout(() => focusInput(800), 0);
  }

  window.ArenaHelper.features = window.ArenaHelper.features || {};
  window.ArenaHelper.features.autofocus = { attach, focusInput };
})();
