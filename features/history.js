/* Lightweight, local-only activity history for the popup.
 * Prompt content is reduced to a short preview; no activity is sent off-device.
 */
(function () {
  'use strict';
  const { on, recordActivity } = window.ArenaHelper;

  function preview(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  }

  function attach() {
    on('prompt:sent', ({ text } = {}) => recordActivity('Prompt sent', preview(text)));
    on('response:started', () => recordActivity('Response started', 'Arena is generating a response.'));
    on('response:done', () => recordActivity('Response finished', 'Arena finished generating.'));
    on('queue:updated', ({ count, stopping } = {}) => {
      recordActivity(stopping ? 'Queue stopped' : 'Queue updated', stopping
        ? 'Pending prompts were cleared.'
        : `${Number(count) || 0} prompt${Number(count) === 1 ? '' : 's'} remaining.`);
    });
    on('auto-continue:clicked', ({ count } = {}) => recordActivity('Auto-continue clicked', `Continuation ${Number(count) || 1}.`));
    on('safety:limit', ({ message } = {}) => recordActivity('Safety guard', message || 'An automation limit was reached.'));
    on('captcha:entered', ({ reason } = {}) => recordActivity('Automation paused', reason || 'Captcha or challenge detected.'));
    on('captcha:exited', () => recordActivity('Automation resumed', 'Captcha safe mode ended.'));
  }

  window.ArenaHelper.features = window.ArenaHelper.features || {};
  window.ArenaHelper.features.history = { attach };
})();
