/* Prevents accidental tab close when:
 *  - assistant is currently responding, OR
 *  - there are queued prompts, OR
 *  - input has text (user may have unsent work).
 */
(function () {
  'use strict';
  const { settings, runtime, ui } = window.ArenaHelper;

  function handler(e) {
    if (!settings.closeProtect) return;
    if (!runtime.hasChatUi) return;
    const dangerous = runtime.isAssistantResponding
      || (runtime.queuedPrompts && runtime.queuedPrompts.length > 0)
      || settings.stopAfterThis;
    const inp = ui.findChatInput();
    const hasText = inp ? ui.getInputText(inp).trim().length > 0 : false;
    if (dangerous || hasText) {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  }

  function attach() {
    window.addEventListener('beforeunload', handler);
  }

  window.ArenaHelper.features = window.ArenaHelper.features || {};
  window.ArenaHelper.features.closeprotect = { attach };
})();
