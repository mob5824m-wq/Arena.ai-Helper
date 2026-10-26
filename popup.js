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
    closeProtect: true
  };

  const defaultSnippets = [
    { id: 'tldr', label: 'TL;DR', body: 'Summarize the above concisely in bullet points.' },
    { id: 'continue', label: 'Continue', body: 'Please continue from where you left off.' },
    { id: 'concise', label: 'Rewrite concisely', body: 'Rewrite your last answer more concisely, keeping the key information.' },
    { id: 'explain', label: 'Explain simply', body: 'Explain this to me as if I were new to the topic. Avoid jargon.' },
    { id: 'critique', label: 'Critique this', body: 'Critique the above answer: point out gaps, risks, and alternative approaches.' }
  ];

  const boolIds = [
    'autoScroll', 'scrollPauseOnManualScroll', 'autoSend', 'multiQueueEnabled',
    'autoContinue', 'doneNotification', 'doneSound', 'autoFocus',
    'showFloatingStatus', 'showCopyCode', 'showTimestamps', 'closeProtect'
  ];

  let snippets = [];

  function loadSettings(cb) {
    chrome.storage.sync.get({ ...defaults, snippets: defaultSnippets }, (items) => {
      for (const id of boolIds) {
        const el = document.getElementById(id);
        if (el) el.checked = !!items[id];
      }
      const delim = document.getElementById('queueDelimiter');
      if (delim) delim.value = items.queueDelimiter || '---';
      snippets = Array.isArray(items.snippets) && items.snippets.length ? items.snippets : defaultSnippets.slice();
      renderSnippets();
      if (cb) cb();
    });
  }

  function bindBoolToggles() {
    for (const id of boolIds) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => {
        chrome.storage.sync.set({ [id]: el.checked });
      });
    }
    const delim = document.getElementById('queueDelimiter');
    if (delim) {
      delim.addEventListener('change', () => {
        chrome.storage.sync.set({ queueDelimiter: delim.value.trim() || '---' });
      });
    }
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
    // Ensure ids are present (for slash completion)
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
