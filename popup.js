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

  const defaultSnippets = [
    { id: 'tldr', label: 'TL;DR', body: 'Summarize the above concisely in bullet points.' },
    { id: 'continue', label: 'Continue', body: 'Please continue from where you left off.' },
    { id: 'concise', label: 'Rewrite concisely', body: 'Rewrite your last answer more concisely, keeping the key information.' },
    { id: 'explain', label: 'Explain simply', body: 'Explain this to me as if I were new to the topic. Avoid jargon.' },
    { id: 'critique', label: 'Critique this', body: 'Critique the above answer: point out gaps, risks, and alternative approaches.' }
  ];

  // Preset profiles — apply a batch of settings at once.
  const profiles = {
    handsfree: {
      desc: 'All automation on: auto-scroll, auto-send, queue, auto-continue, notifications, focus, close-protect. Walk away and let the agent work.',
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
    chrome.storage.sync.get({ ...defaults, snippets: defaultSnippets }, (items) => {
      currentSettings = { ...defaults, ...items };
      for (const id of boolIds) {
        const el = document.getElementById(id);
        if (el) el.checked = !!currentSettings[id];
      }
      const delim = document.getElementById('queueDelimiter');
      if (delim) delim.value = currentSettings.queueDelimiter || '---';
      snippets = Array.isArray(items.snippets) && items.snippets.length ? items.snippets : defaultSnippets.slice();
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

  // A profile is "active" only if every non-delimiter boolean matches exactly.
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

  function renderSnippets() {
    const list = document.getElementById('snippetsList');
    list.innerHTML = '';
    snippets.forEach((s, i) => {
      const row = document.createElement('div');
      row.className = 'snippet-item';
      row.innerHTML = `
        <input type="text" class="lbl" value="" placeholder="Label" style="flex:0 0 100px;" />
        <input type="text" class="body" value="" placeholder="Prompt text..." />
        <button class="del" title="Remove">✕</button>
      `;
      row.querySelector('.lbl').value = s.label || '';
      row.querySelector('.body').value = s.body || '';
      row.querySelector('.lbl').addEventListener('change', (e) => { snippets[i].label = e.target.value; saveSnippets(); });
      row.querySelector('.body').addEventListener('change', (e) => { snippets[i].body = e.target.value; saveSnippets(); });
      row.querySelector('.del').addEventListener('click', () => { snippets.splice(i, 1); renderSnippets(); saveSnippets(); });
      list.appendChild(row);
    });
  }

  function saveSnippets() {
    const cleaned = snippets.map((s, i) => ({
      id: (s.id || (s.label || 'snippet' + i)).toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
      label: s.label || '',
      body: s.body || ''
    })).filter(s => s.label.trim() || s.body.trim());
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
      snippets.push({ id: 'snippet-' + Date.now(), label: 'New snippet', body: '' });
      renderSnippets();
      saveSnippets();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindBoolToggles();
    bindActions();
    loadSettings();
  });
})();
