/* Floating status pill in the bottom-right corner showing what the helper is doing. */
(function () {
  'use strict';
  const { settings, runtime, on } = window.ArenaHelper;

  let pill = null;

  function ensurePill() {
    if (pill && document.contains(pill)) return pill;
    pill = document.createElement('div');
    pill.setAttribute('data-arena-helper', 'status-pill');
    Object.assign(pill.style, {
      position: 'fixed',
      right: '16px',
      bottom: '16px',
      zIndex: 2147483000,
      padding: '6px 10px',
      borderRadius: '999px',
      background: 'rgba(17,24,39,0.85)',
      color: '#fff',
      fontSize: '12px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
      backdropFilter: 'blur(6px)',
      cursor: 'pointer',
      userSelect: 'none',
      transition: 'opacity 0.2s',
      opacity: '0.9'
    });
    pill.addEventListener('click', () => {
      // Clicking the pill toggles the popover? For now, just hide temporarily
      pill.style.display = 'none';
      setTimeout(() => { if (pill) pill.style.display = ''; }, 4000);
    });
    document.body.appendChild(pill);
    return pill;
  }

  function render() {
    if (!settings.showFloatingStatus) { if (pill) pill.style.display = 'none'; return; }
    if (!runtime.hasChatUi) { if (pill) pill.style.display = 'none'; return; }
    const p = ensurePill();
    p.style.display = '';

    let state;
    if (runtime.isAssistantResponding) state = '🟣 Generating';
    else if (settings.stopAfterThis) state = '🟡 Stopping after this';
    else if (runtime.queuedPrompts && runtime.queuedPrompts.length > 0) state = `🟢 Queued: ${runtime.queuedPrompts.length}`;
    else state = '⚪ Idle';

    const flags = [];
    if (settings.autoScroll) flags.push('AS');
    if (settings.autoSend) flags.push('ASend');
    if (settings.autoContinue) flags.push('AC');
    if (runtime.userScrolledUp) flags.push('(scroll paused)');
    p.textContent = `${state} · ${flags.join(' · ')}`;
  }

  function attach() {
    render();
    // Re-render on state changes
    setInterval(render, 800);
    on('queue:updated', render);
    on('response:started', render);
    on('response:done', render);
    window.ArenaHelper.onSettingsChange(() => render());
  }

  window.ArenaHelper.features = window.ArenaHelper.features || {};
  window.ArenaHelper.features.floatingstatus = { attach };
})();
