/* Captcha / human-verification detector.
 *
 * When any kind of captcha, Cloudflare challenge, "verify you are human",
 * hCaptcha / reCAPTCHA / Turnstile iframe, or rate-limit page is detected,
 * the helper goes into SAFE MODE:
 *   - auto-send is paused (won't submit anything)
 *   - auto-continue is paused
 *   - the queue is preserved but drained only after the captcha clears
 *   - auto-scroll still runs (so the user can see the challenge)
 *   - a sticky banner is shown explaining what happened + offering "Resume"
 *   - a desktop notification fires
 *
 * Once the captcha element disappears for >=2 seconds, automation resumes
 * automatically (no input is sent until the user dismisses / solves the challenge).
 */
(function () {
  'use strict';
  const { settings, runtime, on, emit, setSetting } = window.ArenaHelper;
  const { themeColors } = window.ArenaHelper.theme;

  let banner = null;
  let safeMode = false;
  let clearAt = 0;
  let savedAutoSend = null;
  let savedAutoContinue = null;

  // ------ Detection heuristics ------
  // Returns a string reason if a captcha-like element is found, else null.
  function detectCaptcha() {
    // 1) iframes from known captcha providers
    const iframeSrcs = [
      'challenges.cloudflare.com',
      'recaptcha.net',
      'google.com/recaptcha',
      'www.google.com/recaptcha',
      'hcaptcha.com',
      'newassets.hcaptcha.com',
      'api.arkoselabs.com',
      'client-api.arkoselabs.com',
      'funcaptcha.com',
      'turnstile',
      '/cdn-cgi/challenge-platform'
    ];
    const frames = document.querySelectorAll('iframe');
    for (const f of frames) {
      if (!f.offsetParent && f.style.display === 'none') continue; // hidden iframe skip
      const src = (f.src || '').toLowerCase();
      for (const needle of iframeSrcs) {
        if (src.includes(needle.toLowerCase())) return `captcha iframe (${needle})`;
      }
      const title = (f.title || '').toLowerCase();
      if (title.includes('captcha') || title.includes('verify') || title.includes('challenge')) {
        return 'captcha iframe (title)';
      }
    }

    // 2) Common captcha widgets embedded directly (div scripts)
    const widgetClasses = [
      'g-recaptcha', 'h-captcha', 'cf-turnstile', 'arkose-captcha',
      'data-captcha', '[id*="captcha"]', '[class*="captcha"]', '[class*="challenge"]'
    ];
    for (const sel of ['.g-recaptcha', '.h-captcha', '.cf-turnstile', '.arkose-captcha', '[id*="captcha" i]', '[class*="captcha" i]', '[class*="turnstile" i]']) {
      const el = document.querySelector(sel);
      if (el && isElementVisible(el)) {
        return `captcha widget (${sel})`;
      }
    }

    // 3) Cloudflare interstitial / "verify you are human" / "just a moment"
    const pageText = document.body ? (document.body.innerText || '') : '';
    const phrases = [
      'verify you are human',
      'please complete the security check',
      'checking your browser',
      'just a moment',
      'one more step',
      'unusual traffic',
      'solve this captcha',
      'captcha challenge',
      'we need to verify',
      'rate limit exceeded',
      'too many requests',
      'proof of work',
      'cloudflare'
    ];
    for (const p of phrases) {
      if (pageText.toLowerCase().includes(p)) {
        // Must be prominent: either body is short (Cloudflare interstitial replaces the whole page),
        // or an element with that text is visible and centrally placed.
        if (document.body && document.body.innerText.trim().length < 2000) {
          return `challenge page (${p})`;
        }
        // Look for a visible element containing this phrase
        const elements = document.querySelectorAll('h1, h2, h3, p, div, span');
        for (const e of elements) {
          const t = (e.innerText || '').toLowerCase();
          if (t.includes(p) && isElementVisible(e)) {
            return `challenge text (${p})`;
          }
        }
      }
    }

    // 4) Input with captcha label
    const inputs = document.querySelectorAll('input, textarea');
    for (const inp of inputs) {
      const lbl = (inp.getAttribute('placeholder') || inp.getAttribute('aria-label') || '').toLowerCase();
      if (lbl.includes('captcha') || lbl.includes('verification code')) {
        if (isElementVisible(inp)) return 'captcha input';
      }
    }

    return null;
  }

  function isElementVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return true;
  }

  // ------ Banner UI ------
  function ensureBanner(reason) {
    if (banner && document.contains(banner)) {
      const msg = banner.querySelector('[data-arena-helper="captcha-reason"]');
      if (msg) msg.textContent = reason;
      return banner;
    }
    const c = themeColors();
    banner = document.createElement('div');
    banner.setAttribute('data-arena-helper', 'captcha-banner');
    Object.assign(banner.style, {
      position: 'fixed',
      top: '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 2147483600,
      padding: '10px 14px',
      borderRadius: '10px',
      background: c.bgSolid,
      color: c.fg,
      border: `1px solid ${c.danger}`,
      boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
      fontSize: '13px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      maxWidth: '90vw',
      backdropFilter: 'blur(8px)'
    });
    const icon = document.createElement('span');
    icon.textContent = '🛑';
    icon.style.fontSize = '18px';
    banner.appendChild(icon);

    const text = document.createElement('div');
    text.style.flex = '1';
    text.innerHTML =
      '<b>Captcha/challenge detected</b><br/>' +
      '<span data-arena-helper="captcha-reason" style="color:' + c.fgMuted + ';font-size:12px;"></span>';
    banner.appendChild(text);

    const resume = document.createElement('button');
    resume.type = 'button';
    resume.textContent = 'Resume now';
    Object.assign(resume.style, {
      border: `1px solid ${c.accent}`,
      background: c.accent,
      color: '#fff',
      padding: '6px 10px',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '12px',
      fontWeight: 500
    });
    resume.addEventListener('click', () => exitSafeMode('manual'));
    banner.appendChild(resume);

    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.textContent = '✕';
    Object.assign(dismiss.style, {
      border: 'none',
      background: 'transparent',
      color: c.fgMuted,
      cursor: 'pointer',
      fontSize: '14px',
      padding: '4px 6px'
    });
    dismiss.addEventListener('click', () => { if (banner) banner.remove(); banner = null; });
    banner.appendChild(dismiss);

    document.body.appendChild(banner);
    const msg = banner.querySelector('[data-arena-helper="captcha-reason"]');
    if (msg) msg.textContent = reason;
    return banner;
  }

  function removeBanner() {
    if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
    banner = null;
  }

  function enterSafeMode(reason) {
    if (safeMode) {
      // Update reason text if we already in safe mode
      if (banner) {
        const msg = banner.querySelector('[data-arena-helper="captcha-reason"]');
        if (msg) msg.textContent = reason;
      }
      return;
    }
    safeMode = true;
    runtime.captchaDetected = true;
    runtime.captchaReason = reason;
    clearAt = 0;

    // Snapshot current toggle states so we can restore them.
    savedAutoSend = settings.autoSend;
    savedAutoContinue = settings.autoContinue;

    // Force auto-send and auto-continue off WITHOUT persisting (in-memory only
    // via direct assignment; we flip back on exit).
    setInMemory('autoSend', false);
    setInMemory('autoContinue', false);

    // Clear any queued send cooldown so stale timers don't fire after captcha clears.
    runtime.sendCooldownUntil = Date.now() + 2000;

    emit('captcha:entered', { reason });
    ensureBanner(reason);

    // Desktop notification
    try {
      chrome.runtime.sendMessage({
        type: 'notify',
        title: 'Arena.ai Helper — automation paused',
        message: 'Captcha or security challenge detected. Solve it and automation will resume.'
      });
    } catch (e) {}

    // A soft chime to get attention
    try { window.ArenaHelper.ui.playChime(); } catch (e) {}
  }

  function exitSafeMode(why) {
    if (!safeMode) return;
    safeMode = false;
    runtime.captchaDetected = false;
    runtime.captchaReason = null;
    removeBanner();

    // Restore previous toggle states (if we'd saved them)
    if (savedAutoSend !== null) setInMemory('autoSend', savedAutoSend);
    if (savedAutoContinue !== null) setInMemory('autoContinue', savedAutoContinue);
    savedAutoSend = null;
    savedAutoContinue = null;

    emit('captcha:exited', { reason: why });
    // Give the page a moment to settle, then re-evaluate send state
    setTimeout(() => {
      const { features } = window.ArenaHelper;
      if (features && features.scroll) features.scroll.forceScroll();
      if (features && features.send) features.send.tryAutoSend();
    }, 500);
  }

  // In-memory-only toggle setter: updates settings object and notifies listeners
  // but does NOT write to chrome.storage (so the user's real prefs survive).
  function setInMemory(key, value) {
    window.ArenaHelper.overrideSettingTemp(key, value);
  }

  function tick() {
    if (!runtime.hasChatUi) {
      // Still check for Cloudflare-style interstitials that happen on the whole page
      const reason = detectCaptcha();
      if (reason) enterSafeMode(reason);
      else if (safeMode) {
        // Require 2 seconds of clear before exiting
        if (clearAt === 0) clearAt = Date.now();
        else if (Date.now() - clearAt > 2000) exitSafeMode('cleared');
      } else clearAt = 0;
      return;
    }

    const reason = detectCaptcha();
    if (reason) {
      clearAt = 0;
      enterSafeMode(reason);
    } else if (safeMode) {
      if (clearAt === 0) clearAt = Date.now();
      else if (Date.now() - clearAt > 2000) exitSafeMode('cleared');
    } else {
      clearAt = 0;
    }
  }

  function attach() {
    runtime.captchaDetected = false;
    runtime.captchaReason = null;
    // Check initially and every 800ms. Captchas can appear at any time (rate limit mid-session).
    setTimeout(tick, 500);
    setInterval(tick, 800);

    // When the tab becomes visible again after being backgrounded, re-check
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) tick();
    });

    // Allow manual forced resume (from popup/shortcut)
    window.addEventListener('arena-helper:captcha-resume', () => exitSafeMode('manual'));
  }

  window.ArenaHelper.features = window.ArenaHelper.features || {};
  window.ArenaHelper.features.captcha = { attach, isInSafeMode: () => safeMode, detectCaptcha };
})();
