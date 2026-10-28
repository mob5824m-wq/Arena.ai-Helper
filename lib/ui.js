/* Shared DOM helpers used by features. */
(function () {
  'use strict';
  const { runtime } = window.ArenaHelper;

  // Chrome only allows audio contexts to start after a gesture in the page. Keep a
  // single context and unlock it from a real pointer/key gesture; background
  // response-complete events can then play a chime without producing autoplay
  // errors in DevTools.
  let chimeContext = null;
  let chimeUnlocked = false;

  function unlockChime() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      if (!chimeContext || chimeContext.state === 'closed') chimeContext = new Ctx();
      const markUnlocked = () => { chimeUnlocked = !!chimeContext && chimeContext.state === 'running'; };
      if (chimeContext.state === 'suspended') {
        const resume = chimeContext.resume();
        if (resume && typeof resume.then === 'function') resume.then(markUnlocked).catch(() => {});
        else markUnlocked();
      } else {
        markUnlocked();
      }
    } catch (e) { /* A browser can still reject audio in an embedded frame. */ }
  }

  document.addEventListener('pointerdown', unlockChime, { capture: true, passive: true });
  document.addEventListener('keydown', unlockChime, true);

  function isVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    return true;
  }

  function findChatContainer() {
    // Arena-specific: locate the nearest scrollable ancestor of the messages that sits above the composer.
    const sendBtn = findArenaSendButton(document);
    if (sendBtn) {
      // Walk up the send button's ancestor chain to find the composer, then pick the nearest
      // scrollable sibling/ancestor that does NOT contain the send button (that'd be the message list).
      let c = sendBtn.parentElement;
      for (let i = 0; i < 10 && c; i++) {
        // Look for a preceding sibling that is scrollable (likely the message list)
        let sib = c.previousElementSibling;
        while (sib) {
          const style = window.getComputedStyle(sib);
          const oy = style.overflowY || '';
          if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && sib.clientHeight > 200) {
            return sib;
          }
          sib = sib.previousElementSibling;
        }
        // Also the parent itself, if it is scrollable and bigger than the composer
        const style = window.getComputedStyle(c);
        const oy = style.overflowY || '';
        if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && c.clientHeight > 300 && c.clientWidth > 300) {
          // Make sure this container actually contains messages (children with substantial text)
          const blocks = c.querySelectorAll('div, article, li, section');
          let bigChildCount = 0;
          for (const ch of blocks) if (ch.clientHeight > 40) bigChildCount++;
          if (bigChildCount >= 2) return c;
        }
        c = c.parentElement;
      }
    }
    const candidates = [];
    const all = document.querySelectorAll('*');
    for (const el of all) {
      if (!(el instanceof Element)) continue;
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY || '';
      const isScrollable = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
      if (!isScrollable) continue;
      if (el.clientHeight < 200) continue;
      const textareaCount = el.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"]').length;
      const blocks = el.querySelectorAll('div, article, li, section');
      let bigChildCount = 0;
      for (const ch of blocks) if (ch.clientHeight > 40) bigChildCount++;
      let score = el.clientHeight + Math.min(bigChildCount * 10, 800);
      if (textareaCount > 0) score -= 200;
      if (el === document.body || el === document.documentElement) score -= 300;
      candidates.push({ el, score });
    }
    if (!candidates.length) return null;
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].el;
  }

  function isEditableComposer(el) {
    if (!el || !isVisible(el) || el.clientWidth <= 100) return false;
    if (el.getAttribute && el.getAttribute('aria-disabled') === 'true') return false;
    const tag = (el.tagName || '').toUpperCase();
    if (tag === 'TEXTAREA' || tag === 'INPUT') return el.clientHeight > 20;
    const contenteditable = el.getAttribute && el.getAttribute('contenteditable');
    return el.isContentEditable || contenteditable === 'true' || contenteditable === ''
      || contenteditable === 'plaintext-only' || (el.getAttribute && el.getAttribute('role') === 'textbox');
  }

  function findChatInput() {
    // Arena's current composer is a Tiptap/ProseMirror div. Prefer it explicitly,
    // then fall back to generic text controls for older layouts.
    const composerSelector = [
      '[contenteditable="true"].ProseMirror[aria-disabled="false"]',
      '[contenteditable="true"].ProseMirror',
      '[contenteditable="true"][aria-disabled="false"]',
      '[contenteditable="plaintext-only"]',
      'textarea',
      '[role="textbox"]',
      '[contenteditable="true"]',
      '[contenteditable=""]'
    ].join(', ');

    // Arena-specific: locate a composer in the send button's ancestry first so a
    // code editor or another editable region cannot win the generic search.
    const sendBtn = findArenaSendButton(document);
    if (sendBtn) {
      let container = sendBtn.parentElement;
      for (let i = 0; i < 8 && container; i++) {
        const candidates = container.querySelectorAll(composerSelector);
        for (const candidate of candidates) {
          if (isEditableComposer(candidate)) return candidate;
        }
        container = container.parentElement;
      }
    }

    const candidates = document.querySelectorAll(composerSelector);
    for (const candidate of candidates) {
      if (isEditableComposer(candidate)) return candidate;
    }
    return null;
  }

  // Arena-specific fast-path: button with data-perf-target="send" or aria-label exactly "Send message"
  function findArenaSendButton(root) {
    const scope = root || document;
    // Exact perf-target (from the live Arena markup user shared)
    let btn = scope.querySelector('button[data-perf-target="send"]');
    if (btn && isVisible(btn)) return btn;
    // Exact aria-label match
    const exact = scope.querySelectorAll('button[aria-label]');
    for (const b of exact) {
      if (!isVisible(b)) continue;
      const label = (b.getAttribute('aria-label') || '').trim().toLowerCase();
      if (label === 'send message' || label === 'send') return b;
    }
    return null;
  }

  function findArenaStopButton(root) {
    const scope = root || document;
    const btns = scope.querySelectorAll('button[aria-label]');
    for (const b of btns) {
      if (!isVisible(b)) continue;
      const label = (b.getAttribute('aria-label') || '').trim().toLowerCase();
      // Arena uses these labels while a response is streaming
      if (label === 'stop generating' || label === 'stop' || label === 'stop response' || label === 'cancel') {
        return b;
      }
    }
    // Also check for a non-disabled send button with a stop icon (square inside)
    const send = findArenaSendButton(scope);
    if (send && !send.disabled) {
      // When active during generation the send button sometimes becomes a stop; if it's not disabled and there's no stop btn,
      // we'll rely on detectAssistantResponding's other heuristics. This branch stays conservative.
    }
    return null;
  }

  // Arena shows its own "Scroll to bottom" floating button (aria-label="Scroll to bottom")
  // when the user has scrolled away from the latest message. Clicking it is the most
  // reliable way to scroll, because it uses Arena's own target offset and reveals button behavior.
  function findArenaScrollToBottomButton() {
    const btns = document.querySelectorAll('button[aria-label]');
    for (const b of btns) {
      if (!isVisible(b)) continue;
      const label = (b.getAttribute('aria-label') || '').trim().toLowerCase();
      if (label === 'scroll to bottom' || label === 'scroll down') return b;
    }
    return null;
  }

  function findSendButton(inputEl) {
    // Fast Arena-specific path
    const arenaSend = findArenaSendButton(document);
    if (arenaSend && !arenaSend.disabled) return arenaSend;

    if (!inputEl) {
      // No input hint — still return the arena send if it exists and is enabled
      return arenaSend && !arenaSend.disabled ? arenaSend : null;
    }
    let container = inputEl.parentElement;
    for (let i = 0; i < 8 && container; i++) {
      // Arena-send inside container?
      const arenaInContainer = container.querySelector('button[data-perf-target="send"]');
      if (arenaInContainer && isVisible(arenaInContainer) && !arenaInContainer.disabled) return arenaInContainer;

      const buttons = container.querySelectorAll('button');
      for (const btn of buttons) {
        if (!isVisible(btn)) continue;
        if (btn.disabled) continue;
        const label = (btn.getAttribute('aria-label') || btn.textContent || '').toLowerCase();
        if (/(^|\s)(send message|send|submit|enter)(\s|$)/.test(label)) return btn;
        const hasSvg = btn.querySelector('svg');
        if (hasSvg && btn.clientWidth <= 80 && btn.clientHeight <= 80
            && !label.includes('attach') && !label.includes('mic')
            && !label.includes('more') && !label.includes('menu')) {
          // Likely the send icon, especially if it's near a textarea/contenteditable
          if (container.querySelector('textarea, [contenteditable="true"], [role="textbox"]')) {
            return btn;
          }
        }
      }
      const roleBtns = container.querySelectorAll('[role="button"]');
      for (const rb of roleBtns) {
        if (!isVisible(rb)) continue;
        const label = (rb.getAttribute('aria-label') || rb.textContent || '').toLowerCase();
        if (label.includes('send')) return rb;
      }
      container = container.parentElement;
    }
    return null;
  }

  // Find "continue generating" / "read more" / "regenerate" controls after a response stops.
  function findContinueButton() {
    const isUsable = (el) => el && isVisible(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true';
    const toClickable = (el) => {
      if (!el) return null;
      const tag = (el.tagName || '').toLowerCase();
      if (tag === 'button' || tag === 'a' || el.getAttribute('role') === 'button') return el;
      return el.closest && el.closest('button, a, [role="button"]') || el;
    };
    // The marker can be on Arena's button, icon, or wrapper depending on the UI revision.
    const selectors = [
      '[data-perf-target*="continue" i]',
      '[data-testid*="continue" i]',
      '[aria-label*="continue" i]',
      '[title*="continue" i]',
      '[data-perf-target*="read-more" i]'
    ];
    for (const selector of selectors) {
      const matches = document.querySelectorAll(selector);
      for (const match of matches) {
        const clickable = toClickable(match);
        if (isUsable(clickable)) return clickable;
      }
    }

    const labels = [
      'continue generating', 'continue', 'continue working', 'read more',
      'keep going', 'show more', 'expand', 'regenerate', 'resume generation'
    ];
    const controls = Array.from(document.querySelectorAll('button, a, [role="button"]'));
    for (const control of controls) {
      if (!isUsable(control)) continue;
      const text = (control.getAttribute('aria-label') || control.getAttribute('title') || control.textContent || '')
        .replace(/\s+/g, ' ').toLowerCase().trim();
      if (!text || text.includes('send')) continue;
      if (labels.some((label) => text === label || text.startsWith(label + ' ') || (label.length > 4 && text.includes(label)))) {
        return control;
      }
    }
    return null;
  }

  function getInputText(inputEl) {
    if (!inputEl) return '';
    if (inputEl.tagName === 'TEXTAREA' || inputEl.tagName === 'INPUT') return inputEl.value || '';
    // ProseMirror/Tiptap represents a blank composer as an empty paragraph or a
    // trailing zero-width space. Reading textContent as a fallback catches both
    // existing typed prompts and editor updates that do not emit a native input event.
    return String(inputEl.innerText || inputEl.textContent || '')
      .replace(/[\u200B\uFEFF]/g, '')
      .replace(/\u00A0/g, ' ');
  }

  function setInputText(inputEl, text) {
    if (!inputEl) return;
    if (inputEl.tagName === 'TEXTAREA' || inputEl.tagName === 'INPUT') {
      inputEl.value = text;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    // contenteditable
    inputEl.focus();
    inputEl.innerText = text;
    inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
  }

  function isNearBottom(el, threshold = 100) {
    if (!el) return true;
    if (el === window || el === document.body || el === document.documentElement) {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const viewportH = window.innerHeight;
      const total = document.documentElement.scrollHeight;
      return total - (scrollY + viewportH) < threshold;
    }
    return el.scrollHeight - (el.scrollTop + el.clientHeight) < threshold;
  }

  function scrollToBottom(el, smooth = true) {
    if (!el) {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
      return;
    }
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }

  function detectAssistantResponding() {
    // 1) Strong signal: Arena's own stop button is visible (the send button swaps labels while streaming)
    if (findArenaStopButton(document)) return true;

    // 2) Send button is NOT disabled while the textarea is empty = typically "stop" state
    //    (Arena disables the send button when input is empty in idle state; if it's enabled with empty textarea, model is generating)
    const sendBtn = findArenaSendButton(document);
    if (sendBtn) {
      const inp = findChatInput();
      const txt = inp ? getInputText(inp).trim() : '';
      // The user-provided markup shows `disabled` with class `opacity-50 pointer-events-none` when idle+empty.
      // If the send button has those classes while disabled, that confirms idle.
      const cls = (sendBtn.className || '').toString();
      const looksDisabled = sendBtn.disabled
        || cls.includes('opacity-50')
        || cls.includes('pointer-events-none')
        || sendBtn.getAttribute('aria-disabled') === 'true';
      if (!looksDisabled && txt.length === 0) {
        // During streaming the composer is typically empty and stop button replaces send; if send exists and is enabled while empty, it's likely acting as stop.
        return true;
      }
    }

    // 3) Generic labels
    const stopLabels = ['stop generating', 'stop response', 'generating', 'cancel', 'stop'];
    const buttons = document.querySelectorAll('button, [role="button"]');
    for (const b of buttons) {
      if (!isVisible(b)) continue;
      const t = (b.getAttribute('aria-label') || b.textContent || '').toLowerCase().trim();
      for (const lbl of stopLabels) {
        if (t === lbl || t.startsWith(lbl + ' ')) return true;
      }
    }

    // 4) DOM cues
    const streamingCursors = document.querySelectorAll(
      '[data-streaming], .streaming, .cursor-blink, .typing-indicator, [aria-busy="true"]'
    );
    for (const c of streamingCursors) {
      if (isVisible(c)) return true;
    }
    const loaders = document.querySelectorAll('[class*="loading"], [class*="thinking"], [class*="typing"]');
    for (const l of loaders) {
      if (isVisible(l) && l.offsetHeight > 0) return true;
    }
    return false;
  }

  // Click the send button (or simulate Enter) for the current input.
  function submitInput(inputEl) {
    // Prefer the real Arena send button (even if not inside the input's container)
    const arenaBtn = findArenaSendButton(document);
    if (arenaBtn && !arenaBtn.disabled) {
      arenaBtn.click();
      return true;
    }
    if (inputEl) {
      const btn = findSendButton(inputEl);
      if (btn && !btn.disabled) {
        btn.click();
        return true;
      }
      // React-friendly input event dispatch: simulate natural Enter
      const opts = { key: 'Enter', code: 'Enter', which: 13, keyCode: 13, bubbles: true, cancelable: true };
      inputEl.dispatchEvent(new KeyboardEvent('keydown', opts));
      inputEl.dispatchEvent(new KeyboardEvent('keypress', opts));
      inputEl.dispatchEvent(new KeyboardEvent('keyup', opts));
      return true;
    }
    return false;
  }

  // Try to detect chat message elements (best effort, works with most LLM chat UIs).
  function findMessages() {
    // Look for elements that look like messages: role=article, or divs with data-message-id, or grouped in a conversation container
    const chatContainer = findChatContainer();
    const root = chatContainer || document.body;

    // Heuristic: messages are direct/near-direct children of the chat container with a reasonable height and containing text or code.
    const children = root.querySelectorAll(':scope > div, :scope > article, [data-message-id], [data-testid*="message"], [class*="message"]');
    const out = [];
    for (const c of children) {
      if (!isVisible(c)) continue;
      if (c.clientHeight < 20) continue;
      const text = (c.innerText || '').trim();
      if (text.length < 2) continue;
      out.push(c);
    }
    return out;
  }

  function detectHasChatUi() {
    const inp = findChatInput();
    if (inp) { runtime.hasChatUi = true; return true; }
    // Sometimes the textarea isn't there on very first paint; retry lazily
    return false;
  }

  // Simple chime via WebAudio — no external asset required. Do not create an
  // AudioContext here: response-complete callbacks are not user gestures and
  // Chrome would log an autoplay-policy error.
  function playChime() {
    const ctx = chimeContext;
    if (!chimeUnlocked || !ctx || ctx.state !== 'running') return;
    try {
      const now = ctx.currentTime;
      const notes = [ { f: 880, t: 0 }, { f: 1318.5, t: 0.12 } ];
      for (const n of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = n.f;
        gain.gain.setValueAtTime(0.0001, now + n.t);
        gain.gain.exponentialRampToValueAtTime(0.25, now + n.t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + n.t + 0.25);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(now + n.t);
        osc.stop(now + n.t + 0.3);
      }
    } catch (e) { /* ignore audio-device failures */ }
  }

  function formatTime(ts) {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  // Escape HTML for safer innerHTML insertion (used by copy-code / snippets UI)
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  window.ArenaHelper.ui = {
    isVisible,
    findChatContainer,
    findChatInput,
    findSendButton,
    findArenaSendButton,
    findArenaStopButton,
    findArenaScrollToBottomButton,
    findContinueButton,
    getInputText,
    setInputText,
    isNearBottom,
    scrollToBottom,
    detectAssistantResponding,
    submitInput,
    findMessages,
    detectHasChatUi,
    playChime,
    formatTime,
    escapeHtml
  };
})();
