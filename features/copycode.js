/* Adds a small "Copy" button to every <pre> block in the conversation. */
(function () {
  'use strict';
  const { settings, ui } = window.ArenaHelper;
  const BUTTON_ID_DATA = 'arenaHelperCopyBtn';

  function addButtons(root) {
    if (!settings.showCopyCode) return;
    const scope = root || document;
    const pres = scope.querySelectorAll('pre');
    pres.forEach(pre => {
      if (pre.dataset[BUTTON_ID_DATA]) return;
      pre.dataset[BUTTON_ID_DATA] = '1';
      // Make sure parent is positioned
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
        border: '1px solid rgba(255,255,255,0.25)',
        background: 'rgba(0,0,0,0.55)',
        color: '#fff',
        cursor: 'pointer',
        opacity: '0.7',
        fontFamily: 'inherit'
      });
      btn.addEventListener('mouseenter', () => { btn.style.opacity = '1'; });
      btn.addEventListener('mouseleave', () => { btn.style.opacity = '0.7'; });
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

  function attach() {
    addButtons();
    const mo = new MutationObserver(() => { addButtons(); });
    mo.observe(document.body, { childList: true, subtree: true });

    window.ArenaHelper.onSettingsChange((key) => {
      if (key === 'showCopyCode' || key === '__all__') {
        if (settings.showCopyCode) addButtons(); else removeButtons();
      }
    });
  }

  window.ArenaHelper.features = window.ArenaHelper.features || {};
  window.ArenaHelper.features.copycode = { attach };
})();
