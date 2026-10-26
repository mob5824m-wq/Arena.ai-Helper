(function () {
  'use strict';

  const defaults = {
    autoScroll: true,
    scrollPauseOnManualScroll: true,
    autoSend: true,
    multiQueueEnabled: true,
    queueDelimiter: '---',
    autoContinue: true,
    doneNotification: true,
    doneSound: true,
    autoFocus: true,
    showFloatingStatus: true,
    showCopyCode: true,
    showTimestamps: false,
    closeProtect: true,
    stopAfterThis: false
  };

  const fallbackDefaults = [
    { id: 'continue',  label: 'Continue',        category: 'General', autoSend: true,  body: 'Please continue from where you left off.' },
    { id: 'tldr',      label: 'TL;DR',           category: 'General', autoSend: true,  body: 'Summarize the above concisely in bullet points.' },
    { id: 'fixcode',   label: 'Fix bugs',        category: 'Code',    autoSend: true,  body: 'Find and fix any bugs in the code above.' }
  ];

  const profiles = {
    handsfree: {
      desc: 'All automation on: auto-scroll, auto-send, queue, auto-continue, notifications, focus, close-protect. Walk away and let the agent work. Automatically pauses if a captcha appears.',
      settings: {
        autoScroll: true, scrollPauseOnManualScroll: true, autoSend: true,
        multiQueueEnabled: true, autoContinue: true, doneNotification: true,
        doneSound: true, autoFocus: true, showFloatingStatus: true,
        showCopyCode: true, showTimestamps: false, closeProtect: true
      }
    },
    chat: {
      desc: 'Normal chat mode: auto-scroll + copy-code + auto-focus + close-protect on; auto-send/queue/auto-continue off so you drive each turn.',
      settings: {
        autoScroll: true, scrollPauseOnManualScroll: true, autoSend: false,
        multiQueueEnabled: false, autoContinue: false, doneNotification: false,
        doneSound: false, autoFocus: true, showFloatingStatus: true,
        showCopyCode: true, showTimestamps: false, closeProtect: true
      }
    },
    off: {
      desc: 'All helper features off. Pure Arena experience.',
      settings: {
        autoScroll: false, scrollPauseOnManualScroll: false, autoSend: false,
        multiQueueEnabled: false, autoContinue: false, doneNotification: false,
        doneSound: false, autoFocus: false, showFloatingStatus: false,
        showCopyCode: false, showTimestamps: false, closeProtect: false
      }
    }
  };

  const boolIds = [
    'autoScroll', 'scrollPauseOnManualScroll', 'autoSend', 'multiQueueEnabled',
    'autoContinue', 'doneNotification', 'doneSound', 'autoFocus',
    'showFloatingStatus', 'showCopyCode', 'showTimestamps', 'closeProtect'
  ];

  let snippets = [];
  let currentSettings = { ...defaults };

  function loadSettings(cb) {
    chrome.storage.sync.get({ ...defaults, snippets: null }, (items) => {
      currentSettings = { ...defaults, ...items };
      for (const id of boolIds) {
        const el = document.getElementById(id);
        if (el) el.checked = !!currentSettings[id];
      }
      const delim = document.getElementById('queueDelimiter');
      if (delim) delim.value = currentSettings.queueDelimiter || '---';
      snippets = Array.isArray(items.snippets) && items.snippets.length
        ? items.snippets.map(normalizeSnippet)
        : getBuiltinDefaults();
      renderSnippets();
      updateActiveProfile();
      const ver = document.getElementById('verLabel');
      try {
        const m = chrome.runtime.getManifest();
        if (ver) ver.textContent = 'v' + m.version;
      } catch (e) {}
      if (cb) cb();
    });
  }

  function getBuiltinDefaults() {
    // Quick prompts defaults are defined in quickprompts.js; mirror a minimal set
    // here in case we can't reach that file (popup context vs content script).
    return fallbackDefaults.slice();
  }

  function normalizeSnippet(s, i) {
    return {
      id: (s.id || ('p' + i)).toString().toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
      label: s.label || s.id || ('Prompt ' + (i + 1)),
      body: s.body || '',
      category: s.category || 'General',
      autoSend: s.autoSend === undefined ? true : !!s.autoSend
    };
  }

  function bindBoolToggles() {
    for (const id of boolIds) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => {
        chrome.storage.sync.set({ [id]: el.checked });
        currentSettings[id] = el.checked;
        updateActiveProfile();
      });
    }
    const delim = document.getElementById('queueDelimiter');
    if (delim) {
      delim.addEventListener('change', () => {
        const v = delim.value.trim() || '---';
        chrome.storage.sync.set({ queueDelimiter: v });
        currentSettings.queueDelimiter = v;
      });
    }
  }

  function detectActiveProfile() {
    for (const name of Object.keys(profiles)) {
      const p = profiles[name].settings;
      let match = true;
      for (const k of Object.keys(p)) {
        if (currentSettings[k] !== p[k]) { match = false; break; }
      }
      if (match) return name;
    }
    return null;
  }

  function updateActiveProfile() {
    const active = detectActiveProfile();
    document.querySelectorAll('.profile').forEach(btn => {
      if (btn.dataset.profile === active) btn.classList.add('active');
      else btn.classList.remove('active');
    });
    const desc = document.getElementById('profileDesc');
    if (active && profiles[active] && desc) {
      desc.textContent = profiles[active].desc;
    } else if (desc) {
      desc.textContent = 'Custom settings (mix of toggles).';
    }
  }

  function applyProfile(name) {
    const p = profiles[name];
    if (!p) return;
    const toSet = { ...p.settings };
    chrome.storage.sync.set(toSet);
    Object.assign(currentSettings, toSet);
    for (const k of Object.keys(toSet)) {
      const el = document.getElementById(k);
      if (el) el.checked = toSet[k];
    }
    updateActiveProfile();
  }

  const categories = ['General', 'Code', 'Writing', 'Agent'];

  function renderSnippets() {
    const list = document.getElementById('snippetsList');
    list.innerHTML = '';
    snippets.forEach((s, i) => {
      const row = document.createElement('div');
      row.className = 'snippet-item';
      const catOpts = categories.map(c => `<option value="${c}" ${s.category===c?'selected':''}>${c}</option>`).join('');
      row.innerHTML = `
        <input type="text" class="lbl" value="" placeholder="Label" />
        <input type="text" class="bdy" value="" placeholder="Prompt text..." />
        <label class="as-lbl" title="Auto-send when clicked">
          <input type="checkbox" class="as" /> ⏎ send
        </label>
        <button class="del" title="Remove">✕</button>
        <div class="meta">
          <select class="cat">${catOpts}<option value="Other" ${s.category==='Other'?'selected':''}>Other</option></select>
          <span style="margin-left:auto;color:#9ca3af;font-size:10px;">/</span>
          <input type="text" class="id" placeholder="slash id" style="width:80px;border:1px solid #e5e7eb;border-radius:4px;padding:2px 4px;font-size:11px;" />
        </div>
      `;
      row.querySelector('.lbl').value = s.label || '';
      row.querySelector('.bdy').value = s.body || '';
      row.querySelector('.as').checked = !!s.autoSend;
      row.querySelector('.id').value = s.id || '';

      const update = () => {
        snippets[i].label = row.querySelector('.lbl').value;
        snippets[i].body = row.querySelector('.bdy').value;
        snippets[i].autoSend = row.querySelector('.as').checked;
        snippets[i].category = row.querySelector('.cat').value;
        const idv = (row.querySelector('.id').value || snippets[i].label || ('p' + i)).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
        snippets[i].id = idv || ('p' + i);
        saveSnippets();
      };
      row.querySelector('.lbl').addEventListener('change', update);
      row.querySelector('.bdy').addEventListener('change', update);
      row.querySelector('.as').addEventListener('change', update);
      row.querySelector('.cat').addEventListener('change', update);
      row.querySelector('.id').addEventListener('change', update);
      row.querySelector('.del').addEventListener('click', () => { snippets.splice(i, 1); renderSnippets(); saveSnippets(); });
      list.appendChild(row);
    });
  }

  function saveSnippets() {
    const cleaned = snippets.map(normalizeSnippet).filter(s => s.label.trim() || s.body.trim());
    snippets = cleaned;
    chrome.storage.sync.set({ snippets: cleaned });
  }

  function sendToActiveTab(message) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, message, () => void chrome.runtime.lastError);
      }
    });
  }

  function bindActions() {
    document.querySelectorAll('.profile').forEach(btn => {
      btn.addEventListener('click', () => applyProfile(btn.dataset.profile));
    });
    document.getElementById('exportBtn').addEventListener('click', () => {
      sendToActiveTab({ type: 'cmd:export-markdown' });
      window.close();
    });
    document.getElementById('clearQueueBtn').addEventListener('click', () => {
      sendToActiveTab({ type: 'cmd:clear-input' });
    });
    document.getElementById('addSnippet').addEventListener('click', () => {
      snippets.push({ id: 'p' + Date.now(), label: 'New prompt', body: '', category: 'General', autoSend: true });
      renderSnippets();
      saveSnippets();
    });
    document.getElementById('resetSnippets').addEventListener('click', () => {
      if (!confirm('Reset quick prompts to defaults? Your custom prompts will be replaced.')) return;
      // Pull defaults from chrome.storage by unsetting, then reloading defaults from next launch.
      chrome.storage.sync.remove('snippets', () => {
        snippets = getBuiltinDefaults();
        renderSnippets();
        chrome.storage.sync.set({ snippets });
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindBoolToggles();
    bindActions();
    loadSettings();
  });
})();
