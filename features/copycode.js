/* Adds a small "Copy" button to every <pre> block in the conversation. Theme-aware. */
(function () {
  'use strict';
  const { settings, theme } = window.ArenaHelper;
  const BUTTON_ID_DATA = 'arenaHelperCopyBtn';

  function addButtons(root) {
    if (!settings.showCopyCode) return;
    const scope = root || document;
    const c = theme.themeColors();
    const pres = scope.querySelectorAll('pre');
    pres.forEach(pre => {
      if (pre.dataset[BUTTON_ID_DATA]) return;
      pre.dataset[BUTTON_ID_DATA] = '1';
      const parent = pre.parentElement;
      if (parent) parent.style.position = parent.style.position || 'relative';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Copy';
      btn.setAttribute('data-arena-helper', 'copy-code');
      Object.assign(btn.style, {
        position: 'absolute',
        top: '6px',
        right: '6px',
        zIndex: '10',
        padding: '3px 8px',
        fontSize: '11px',
        lineHeight: '1.2',
        borderRadius: '4px',
        border: `1px solid ${c.border}`,
        background: c.buttonBg,
        color: c.fg,
        cursor: 'pointer',
        opacity: '0.6',
        fontFamily: 'inherit',
        backdropFilter: 'blur(4px)'
      });
      btn.addEventListener('mouseenter', () => { btn.style.opacity = '1'; });
      btn.addEventListener('mouseleave', () => { btn.style.opacity = '0.6'; });
      btn.addEventListener('click', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const codeEl = pre.querySelector('code') || pre;
        const text = codeEl.innerText || '';
        try {
          await navigator.clipboard.writeText(text);
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = 'Copy'; }, 1200);
        } catch (e) {
          btn.textContent = 'Error';
          setTimeout(() => { btn.textContent = 'Copy'; }, 1200);
        }
      });
      if (parent) parent.appendChild(btn);
    });
  }

  function removeButtons() {
    document.querySelectorAll('[data-arena-helper="copy-code"]').forEach(b => b.remove());
    document.querySelectorAll('pre').forEach(p => { delete p.dataset[BUTTON_ID_DATA]; });
  }

  function refreshButtons() {
    // Re-apply theme on existing buttons
    document.querySelectorAll('[data-arena-helper="copy-code"]').forEach(b => {
      const c = theme.themeColors();
      b.style.border = `1px solid ${c.border}`;
      b.style.background = c.buttonBg;
      b.style.color = c.fg;
    });
  }

  function attach() {
    addButtons();
    const mo = new MutationObserver(() => addButtons());
    mo.observe(document.body, { childList: true, subtree: true });

    window.ArenaHelper.onSettingsChange((key) => {
      if (key === 'showCopyCode' || key === '__all__') {
        if (settings.showCopyCode) addButtons(); else removeButtons();
      }
    });
    theme.onThemeChange(refreshButtons);
  }

  window.ArenaHelper.features = window.ArenaHelper.features || {};
  window.ArenaHelper.features.copycode = { attach };
})();
