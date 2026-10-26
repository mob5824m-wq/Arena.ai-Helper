/* Adds small HH:MM timestamps to new messages when showTimestamps is on. Theme-aware. */
(function () {
  'use strict';
  const { settings, theme, ui } = window.ArenaHelper;
  const SEEN_PROP = '__arenaHelperTs';

  function color() {
    const c = theme.themeColors();
    // Muted text color with a slight background pill for legibility
    return { fg: c.fgMuted, bg: c.buttonBg };
  }

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
    const col = color();
    Object.assign(ts.style, {
      position: 'absolute',
      top: '2px',
      right: '6px',
      fontSize: '10px',
      color: col.fg,
      background: col.bg,
      padding: '1px 6px',
      borderRadius: '8px',
      pointerEvents: 'none',
      userSelect: 'none',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      opacity: '0.85'
    });
    m.appendChild(ts);
  }

  function removeTimestamps() {
    document.querySelectorAll('[data-arena-helper="timestamp"]').forEach(t => t.remove());
    ui.findMessages().forEach(m => { m[SEEN_PROP] = false; });
  }

  function refreshColors() {
    const col = color();
    document.querySelectorAll('[data-arena-helper="timestamp"]').forEach(t => {
      t.style.color = col.fg;
      t.style.background = col.bg;
    });
  }

  function attach() {
    stampExisting();
    const mo = new MutationObserver(() => stampExisting());
    mo.observe(document.body, { childList: true, subtree: true });

    window.ArenaHelper.onSettingsChange((key) => {
      if (key === 'showTimestamps' || key === '__all__') {
        if (settings.showTimestamps) stampExisting(); else removeTimestamps();
      }
    });
    theme.onThemeChange(refreshColors);
  }

  window.ArenaHelper.features = window.ArenaHelper.features || {};
  window.ArenaHelper.features.timestamps = { attach };
})();
