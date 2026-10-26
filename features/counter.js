/* Tiny char/token counter attached to the chat input. Shows "chars / ~tokens"
 * in the corner of the composer. Tokens are a rough estimate (chars / 4) — not
 * model-specific, but useful as a "you're writing a novel" warning.
 */
(function () {
  'use strict';
  const { runtime, theme, ui } = window.ArenaHelper;
  let badge = null;
  let currentInput = null;

  function ensureBadge() {
    const inp = ui.findChatInput();
    if (!inp) return null;
    if (badge && badge.parentNode && currentInput === inp) return badge;

    // Remove any stale badge from a previous input element
    if (badge && badge.parentNode) badge.parentNode.removeChild(badge);

    currentInput = inp;
    const c = theme.themeColors();
    badge = document.createElement('div');
    badge.setAttribute('data-arena-helper', 'counter');
    Object.assign(badge.style, {
      position: 'absolute',
      right: '52px',
      bottom: '10px',
      fontSize: '10px',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      color: c.fgMuted,
      background: c.buttonBg,
      padding: '2px 6px',
      borderRadius: '6px',
      pointerEvents: 'none',
      userSelect: 'none',
      zIndex: 998,
      opacity: '0.75'
    });
    // Make sure parent is positioned
    const parent = inp.parentElement;
    if (parent) {
      const ps = window.getComputedStyle(parent).position;
      if (ps === 'static') parent.style.position = 'relative';
      parent.appendChild(badge);
    }
    update();
    return badge;
  }

  function estimateTokens(text) {
    if (!text) return 0;
    // Rough rule of thumb: ~4 chars per token for English text/code, plus some slack.
    return Math.ceil(text.length / 4);
  }

  function update() {
    if (!badge) return;
    const inp = currentInput || ui.findChatInput();
    if (!inp) return;
    const text = ui.getInputText(inp) || '';
    const chars = text.length;
    const toks = estimateTokens(text);
    badge.textContent = `${chars} ch / ~${toks} tok`;
    const c = theme.themeColors();
    // If input is huge, warn with accent color
    if (chars > 12000) { badge.style.color = c.danger; badge.style.opacity = '1'; }
    else if (chars > 4000) { badge.style.color = c.accent; badge.style.opacity = '1'; }
    else { badge.style.color = c.fgMuted; badge.style.opacity = '0.75'; }
  }

  function retheme() {
    if (!badge) return;
    const c = theme.themeColors();
    badge.style.color = c.fgMuted;
    badge.style.background = c.buttonBg;
    update();
  }

  function attach() {
    setInterval(() => {
      ensureBadge();
      update();
    }, 500);
    ensureBadge();
    document.addEventListener('input', update, true);
    theme.onThemeChange(retheme);
  }

  window.ArenaHelper.features = window.ArenaHelper.features || {};
  window.ArenaHelper.features.counter = { attach };
})();
