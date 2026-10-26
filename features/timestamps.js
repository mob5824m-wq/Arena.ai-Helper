/* Adds small HH:MM timestamps to new messages when showTimestamps is on. */
(function () {
  'use strict';
  const { settings, runtime, ui } = window.ArenaHelper;
  const SEEN_PROP = '__arenaHelperTs';

  function stampExisting() {
    if (!settings.showTimestamps) return;
    const msgs = ui.findMessages();
    for (const m of msgs) {
      if (m[SEEN_PROP]) continue;
      addTimestamp(m);
    }
  }

  function addTimestamp(m) {
    if (m[SEEN_PROP]) return;
    m[SEEN_PROP] = true;
    m.style.position = m.style.position || 'relative';
    const ts = document.createElement('span');
    ts.setAttribute('data-arena-helper', 'timestamp');
    ts.textContent = ui.formatTime(Date.now());
    Object.assign(ts.style, {
      position: 'absolute',
      top: '2px',
      right: '6px',
      fontSize: '10px',
      color: 'rgba(128,128,128,0.7)',
      pointerEvents: 'none',
      userSelect: 'none',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace'
    });
    m.appendChild(ts);
  }

  function removeTimestamps() {
    document.querySelectorAll('[data-arena-helper="timestamp"]').forEach(t => t.remove());
    ui.findMessages().forEach(m => { m[SEEN_PROP] = false; });
  }

  function attach() {
    stampExisting();
    const mo = new MutationObserver(() => { stampExisting(); });
    mo.observe(document.body, { childList: true, subtree: true });

    window.ArenaHelper.onSettingsChange((key) => {
      if (key === 'showTimestamps' || key === '__all__') {
        if (settings.showTimestamps) stampExisting(); else removeTimestamps();
      }
    });
  }

  window.ArenaHelper.features = window.ArenaHelper.features || {};
  window.ArenaHelper.features.timestamps = { attach };
})();
