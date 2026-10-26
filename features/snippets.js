/* Quick-paste snippets. Adds a small "✦" button next to the chat input that opens
 * a popover list of saved snippets. Clicking one inserts it into the input.
 * Slash-command: type "/snippet-name" and press Tab to insert (best-effort).
 * Snippets are stored in chrome.storage.sync under "snippets".
 */
(function () {
  'use strict';
  const defaults = [
    { id: 'tldr', label: 'TL;DR', body: 'Summarize the above concisely in bullet points.' },
    { id: 'continue', label: 'Continue', body: 'Please continue from where you left off.' },
    { id: 'concise', label: 'Rewrite concisely', body: 'Rewrite your last answer more concisely, keeping the key information.' },
    { id: 'explain', label: 'Explain simply', body: 'Explain this to me as if I were new to the topic. Avoid jargon.' },
    { id: 'critique', label: 'Critique this', body: 'Critique the above answer: point out gaps, risks, and alternative approaches.' }
  ];
  let snippets = [];
  let popover = null;
  let button = null;

  function loadSnippets() {
    try {
      chrome.storage.sync.get({ snippets: defaults }, (res) => {
        snippets = Array.isArray(res.snippets) ? res.snippets : defaults.slice();
      });
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync' && changes.snippets) {
          snippets = Array.isArray(changes.snippets.newValue) ? changes.snippets.newValue : defaults.slice();
        }
      });
    } catch (e) {
      snippets = defaults.slice();
    }
  }

  function ensureButton() {
    const inp = findInput();
    if (!inp) return;
    if (button && document.contains(button)) return;
    let target = inp.parentElement;
    for (let i = 0; i < 4 && target; i++) {
      if (target.querySelector('button')) break;
      target = target.parentElement;
    }
    if (!target) target = inp.parentElement;
    button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('data-arena-helper', 'snippets-btn');
    button.title = 'Arena.ai Helper snippets';
    button.textContent = '✦';
    const c = window.ArenaHelper.theme.themeColors();
    Object.assign(button.style, {
      position: 'absolute',
      bottom: '8px',
      left: '8px',
      width: '28px',
      height: '28px',
      borderRadius: '6px',
      border: `1px solid ${c.border}`,
      background: c.accent,
      color: '#fff',
      cursor: 'pointer',
      zIndex: 999,
      fontSize: '14px',
      lineHeight: '1',
      padding: 0
    });
    if (target) {
      const ps = window.getComputedStyle(target).position;
      if (ps === 'static') target.style.position = 'relative';
    }
    inp.parentElement.appendChild(button);
    button.addEventListener('click', (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      togglePopover();
    });
  }

  function findInput() {
    return window.ArenaHelper.ui.findChatInput();
  }

  function closePopover() {
    if (popover && popover.parentNode) popover.parentNode.removeChild(popover);
    popover = null;
  }

  function togglePopover() {
    if (popover) { closePopover(); return; }
    const inp = findInput();
    if (!inp) return;
    const c = window.ArenaHelper.theme.themeColors();
    popover = document.createElement('div');
    popover.setAttribute('data-arena-helper', 'snippets-popover');
    Object.assign(popover.style, {
      position: 'absolute',
      bottom: '44px',
      left: '8px',
      background: c.bgSolid,
      color: c.fg,
      border: `1px solid ${c.border}`,
      borderRadius: '8px',
      boxShadow: '0 10px 25px rgba(0,0,0,0.18)',
      zIndex: 1000,
      padding: '6px',
      minWidth: '220px',
      maxWidth: '320px',
      maxHeight: '280px',
      overflowY: 'auto',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '13px'
    });
    const header = document.createElement('div');
    header.textContent = 'Snippets';
    Object.assign(header.style, { padding: '4px 8px', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase', color: c.fgMuted, letterSpacing: '0.05em' });
    popover.appendChild(header);
    if (snippets.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'No snippets yet. Add some from the extension popup.';
      Object.assign(empty.style, { padding: '8px', color: c.fgMuted, fontSize: '12px' });
      popover.appendChild(empty);
    } else {
      for (const s of snippets) {
        const item = document.createElement('button');
        item.type = 'button';
        item.textContent = s.label || s.id;
        Object.assign(item.style, {
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: '6px 8px',
          border: 'none',
          background: 'transparent',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '13px',
          color: c.fg
        });
        item.addEventListener('mouseenter', () => { item.style.background = c.accentBg; });
        item.addEventListener('mouseleave', () => { item.style.background = 'transparent'; });
        item.addEventListener('click', (ev) => {
          ev.preventDefault(); ev.stopPropagation();
          insertText(s.body);
          closePopover();
        });
        popover.appendChild(item);
      }
    }
    document.body.appendChild(popover);
    setTimeout(() => {
      document.addEventListener('click', outsideClick, { once: true });
    }, 0);
  }

  function outsideClick(ev) {
    if (popover && !popover.contains(ev.target) && ev.target !== button) closePopover();
    else document.addEventListener('click', outsideClick, { once: true });
  }

  function insertText(text) {
    const inp = findInput();
    if (!inp) return;
    inp.focus();
    if (inp.tagName === 'TEXTAREA' || inp.tagName === 'INPUT') {
      const start = inp.selectionStart ?? inp.value.length;
      const end = inp.selectionEnd ?? inp.value.length;
      const before = inp.value.slice(0, start);
      const after = inp.value.slice(end);
      inp.value = before + text + after;
      const pos = before.length + text.length;
      inp.setSelectionRange(pos, pos);
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && inp.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(text));
        range.collapse(false);
      } else {
        inp.innerText = (inp.innerText || '') + text;
      }
      inp.dispatchEvent(new InputEvent('input', { bubbles: true }));
    }
  }

  function onKeyDown(ev) {
    if (ev.key !== 'Tab') return;
    const inp = ev.target;
    if (!inp || (inp.tagName !== 'TEXTAREA' && inp.getAttribute && inp.getAttribute('contenteditable') !== 'true')) return;
    const text = window.ArenaHelper.ui.getInputText(inp);
    const m = /\/([a-zA-Z0-9_-]+)\s*$/.exec(text);
    if (!m) return;
    const key = m[1].toLowerCase();
    const sn = snippets.find(s => (s.id || '').toLowerCase() === key || (s.label || '').toLowerCase() === key);
    if (!sn) return;
    ev.preventDefault();
    const newText = text.replace(/\/([a-zA-Z0-9_-]+)\s*$/, sn.body);
    window.ArenaHelper.ui.setInputText(inp, newText);
  }

  function attach() {
    loadSnippets();
    document.addEventListener('keydown', onKeyDown, true);
    setInterval(ensureButton, 1500);
    ensureButton();
    // Re-style button when theme changes
    window.ArenaHelper.theme.onThemeChange(() => {
      if (button) {
        const c = window.ArenaHelper.theme.themeColors();
        button.style.border = `1px solid ${c.border}`;
        button.style.background = c.accent;
      }
    });
  }

  window.ArenaHelper.features = window.ArenaHelper.features || {};
  window.ArenaHelper.features.snippets = { attach };
})();
