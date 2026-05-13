/* ============================================================
   VoxNote — PWA do notatek głosowych z podsumowaniem Claude AI
   ============================================================ */

(() => {
'use strict';

// ===== STAŁE =====
const LS = {
  notes: 'vn_notes',
  apiKey: 'vn_api_key',
  sessionName: 'vn_session_name',
  customPrompt: 'vn_custom_prompt',
  templates: 'vn_templates'
};

// ===== ICONS (Phosphor Thin style, stroke 1) =====
const _svg = (paths, size = 20) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const ICONS = {
  settings: _svg('<circle cx="12" cy="12" r="3.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77"/>'),
  sparkles: _svg('<path d="M12 2.5 L13.7 10.3 L21.5 12 L13.7 13.7 L12 21.5 L10.3 13.7 L2.5 12 L10.3 10.3 Z"/><path d="M19 4l.6 1.8L21.5 6.5l-1.9.7L19 9l-.6-1.8L16.5 6.5l1.9-.7z"/>'),
  share: _svg('<path d="M12 15V3"/><path d="M7 8l5-5 5 5"/><path d="M5 14v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6"/>'),
  trash: _svg('<rect x="5" y="6.5" width="14" height="14.5" rx="1"/><path d="M3 6.5h18"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/><path d="M9 6.5V3.5h6v3"/>'),
  'arrow-left': _svg('<path d="M19 12H5"/><path d="M12 5l-7 7 7 7"/>'),
  microphone: _svg('<rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5 10.5v1a7 7 0 0 0 14 0v-1"/><line x1="12" x2="12" y1="18.5" y2="21.5"/><line x1="9" x2="15" y1="21.5" y2="21.5"/>'),
  stop: _svg('<rect x="6" y="6" width="12" height="12" rx="1"/>'),
  'check-circle': _svg('<circle cx="12" cy="12" r="10"/><path d="M7 12.5l3.5 3.5 7-7"/>'),
  'alert-circle': _svg('<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="7" y2="13"/><circle cx="12" cy="16.5" r="0.5" fill="currentColor"/>'),
  notebook: _svg('<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 3v18"/><line x1="13" x2="17" y1="8" y2="8"/><line x1="13" x2="17" y1="12" y2="12"/><line x1="13" x2="17" y1="16" y2="16"/>')
};

function paintIcons(root) {
  (root || document).querySelectorAll('[data-icon]').forEach(el => {
    const name = el.dataset.icon;
    if (ICONS[name]) el.innerHTML = ICONS[name];
  });
}

const SUMMARY_PROMPT = `Przeanalizuj poniższe notatki głosowe i przygotuj czytelne podsumowanie po polsku według struktury:

📍 MIEJSCE I KONTEKST

🌟 NAJWAŻNIEJSZE DO ZAPAMIĘTANIA (max 5 punktów)

📝 PRZEBIEG CHRONOLOGICZNY

💡 PRAKTYCZNE INFORMACJE
(nazwy, liczby, adresy, ceny, godziny)

❤️ OSOBISTE REFLEKSJE I OCENY

🔍 DO SPRAWDZENIA PÓŹNIEJ

Używaj punktów. Pomijaj sekcje, które nie mają treści. Oto notatki:`;

const BUILTIN_TEMPLATE = {
  id: 'builtin-notes',
  label: 'Notatki',
  prompt: SUMMARY_PROMPT,
  builtin: true
};

function getTemplates() {
  let custom = [];
  try { custom = JSON.parse(localStorage.getItem(LS.templates)) || []; }
  catch { custom = []; }
  return [BUILTIN_TEMPLATE, ...custom];
}

// ===== STATE =====
let notes = loadNotes();
let sessionName = localStorage.getItem(LS.sessionName) || defaultSessionName();
let lastSummary = '';

let recognition = null;
let isRecording = false;
let committedTranscript = '';
let finalTranscript = '';
let interimTranscript = '';

// ===== DOM =====
const $ = (id) => document.getElementById(id);
const screenMain = $('screen-main');
const screenSummary = $('screen-summary');
const sessionInput = $('session-name');
const recBtn = $('btn-record');
const recLabel = recBtn.querySelector('.rec-label');
const livePreview = $('live-preview');
const notesList = $('notes-list');
const notesCount = $('notes-count');
const btnSummarize = $('btn-summarize');
const btnExport = $('btn-export');
const btnNewSession = $('btn-new-session');
const btnSettings = $('btn-settings');
const modal = $('modal-settings');
const apiKeyInput = $('api-key-input');
const apiKeyStatus = $('api-key-status');
const btnSaveKey = $('btn-save-key');
const btnCloseSettings = $('btn-close-settings');
const spinner = $('spinner');
const toastEl = $('toast');
const summaryContent = $('summary-content');
const summarySession = $('summary-session');
const btnBack = $('btn-back');
const btnBackBottom = $('btn-back-bottom');
const btnShareSummary = $('btn-share-summary');
const btnShareAll = $('btn-share-all');
const modalSummarize = $('modal-summarize');
const tplList = $('tpl-list');
const customPromptInput = $('custom-prompt-input');
const btnRunCustom = $('btn-run-custom');
const btnCloseSummarize = $('btn-close-summarize');
const btnDictatePrompt = $('btn-dictate-prompt');

let dictation = null;

// ===== INIT =====
function init() {
  paintIcons();
  sessionInput.value = sessionName;
  renderNotes();
  refreshActionPanel();
  refreshKeyStatus();
  bindEvents();
  registerSW();
  prewarmMic();
}

async function prewarmMic() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
  } catch { /* user denied or unavailable — ignore */ }
}

function bindEvents() {
  sessionInput.addEventListener('change', () => {
    sessionName = sessionInput.value.trim() || defaultSessionName();
    sessionInput.value = sessionName;
    localStorage.setItem(LS.sessionName, sessionName);
  });

  recBtn.addEventListener('click', toggleRecording);

  btnSummarize.addEventListener('click', openSummarizeModal);
  btnRunCustom.addEventListener('click', runCustomPrompt);
  btnCloseSummarize.addEventListener('click', closeSummarizeModal);
  btnDictatePrompt.addEventListener('click', toggleDictateCustomPrompt);
  btnExport.addEventListener('click', exportNotes);
  btnNewSession.addEventListener('click', newSession);

  btnSettings.addEventListener('click', openSettings);
  btnCloseSettings.addEventListener('click', closeSettings);
  btnSaveKey.addEventListener('click', saveKey);

  btnBack.addEventListener('click', showMain);
  btnBackBottom.addEventListener('click', showMain);
  btnShareSummary.addEventListener('click', () => shareText(buildSummaryOnlyTxt(), filenameFor('-podsumowanie')));
  btnShareAll.addEventListener('click', () => shareText(buildCombinedTxt(), filenameFor('-pelne')));
}

// ===== NOTES =====
function loadNotes() {
  try { return JSON.parse(localStorage.getItem(LS.notes)) || []; }
  catch { return []; }
}

function saveNotes() {
  localStorage.setItem(LS.notes, JSON.stringify(notes));
}

function renderNotes() {
  notesList.innerHTML = '';
  // Najnowsze na górze
  [...notes].reverse().forEach((n, i) => {
    const idxFromTop = notes.length - i; // numeracja chronologiczna
    const li = document.createElement('li');
    li.className = 'note-item';
    li.innerHTML = `
      <div class="note-num">${idxFromTop}</div>
      <div class="note-body">
        <div class="note-text"></div>
        <div class="note-time">${escapeHtml(n.timestamp)}</div>
      </div>
      <button class="note-del" aria-label="Usuń notatkę"><span class="icon-slot" data-icon="trash"></span></button>
    `;
    li.querySelector('.note-text').textContent = n.text;
    li.querySelector('.note-del').addEventListener('click', () => deleteNote(n.id));
    paintIcons(li);
    notesList.appendChild(li);
  });
  notesCount.textContent = notes.length;
}

function deleteNote(id) {
  notes = notes.filter(n => n.id !== id);
  saveNotes();
  renderNotes();
  refreshActionPanel();
}

function refreshActionPanel() {
  const has = notes.length > 0;
  btnSummarize.disabled = !has;
  btnExport.disabled = !has;
  btnNewSession.disabled = !has;
}

// ===== RECORDING =====
function toggleRecording() {
  if (isRecording) stopRecording();
  else startRecording();
}

function startRecording() {
  if (!navigator.onLine) {
    toast('Brak połączenia — nagrywanie wymaga internetu');
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    toast('Twoja przeglądarka nie obsługuje rozpoznawania mowy');
    return;
  }
  recognition = new SR();
  recognition.lang = 'pl-PL';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  committedTranscript = '';
  finalTranscript = '';
  interimTranscript = '';
  livePreview.textContent = '';

  recognition.onresult = (ev) => {
    const finalsArr = [];
    let interim = '';
    for (let i = 0; i < ev.results.length; i++) {
      const res = ev.results[i];
      const t = res[0].transcript.trim();
      if (!t) continue;
      if (res.isFinal) finalsArr.push(t);
      else interim += res[0].transcript;
    }
    // Android Chrome quirk: emits multiple isFinal=true entries with growing prefix.
    // Merge prefix-extending finals (replace), keep independent ones (append).
    let merged = '';
    for (const f of finalsArr) {
      if (!merged) { merged = f; continue; }
      const fLow = f.toLowerCase();
      const mLow = merged.toLowerCase();
      if (fLow.startsWith(mLow)) merged = f;
      else if (mLow.endsWith(fLow)) { /* already included */ }
      else merged += ' ' + f;
    }
    finalTranscript = merged ? merged + ' ' : '';
    interimTranscript = interim;
    livePreview.textContent = (committedTranscript + finalTranscript + interimTranscript).replace(/\s+/g, ' ').trim();
  };

  recognition.onstart = () => {
    setRecUI('recording');
    if (navigator.vibrate) navigator.vibrate(60);
  };

  recognition.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      toast('Brak dostępu do mikrofonu');
    } else if (e.error === 'network') {
      toast('Błąd sieci — sprawdź internet');
    } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
      toast('Błąd rozpoznawania: ' + e.error);
    }
  };

  recognition.onend = () => {
    committedTranscript = (committedTranscript + finalTranscript).replace(/\s+/g, ' ');
    if (!committedTranscript.endsWith(' ')) committedTranscript += ' ';
    finalTranscript = '';
    interimTranscript = '';
    if (isRecording) {
      // Restart for very long sessions if API auto-stopped
      try { recognition.start(); } catch {}
    }
  };

  try {
    recognition.start();
    isRecording = true;
    setRecUI('initializing');
  } catch (err) {
    setRecUI('idle');
    toast('Nie udało się rozpocząć nagrywania');
  }
}

function stopRecording() {
  isRecording = false;
  try { recognition && recognition.stop(); } catch {}
  setRecUI('idle');

  const text = (committedTranscript + finalTranscript + interimTranscript).replace(/\s+/g, ' ').trim();
  if (!text) {
    livePreview.textContent = '';
    toast('Nic nie nagrano — spróbuj ponownie');
    return;
  }

  const note = { id: Date.now(), text, timestamp: nowHHMMSS() };
  notes.push(note);
  saveNotes();
  renderNotes();
  refreshActionPanel();

  committedTranscript = '';
  finalTranscript = '';
  interimTranscript = '';
  livePreview.textContent = '';

  if (navigator.vibrate) navigator.vibrate(200);
}

function setRecUI(state) {
  recBtn.classList.toggle('rec-idle', state === 'idle');
  recBtn.classList.toggle('rec-initializing', state === 'initializing');
  recBtn.classList.toggle('rec-recording', state === 'recording');
  if (state === 'recording') recLabel.textContent = 'Nagrywa...';
  else if (state === 'initializing') recLabel.textContent = 'Czekaj...';
  else recLabel.textContent = 'Naciśnij';
}

// ===== EXPORT / SHARE =====
function buildExportTxt() {
  const lines = [];
  lines.push(`SESJA: ${sessionName}`);
  lines.push(`DATA: ${nowDateTime()}`);
  lines.push(`LICZBA NOTATEK: ${notes.length}`);
  lines.push('=====================================');
  lines.push('');
  notes.forEach((n, i) => {
    lines.push(`NOTATKA ${i + 1} [${n.timestamp}]`);
    lines.push(n.text);
    lines.push('');
  });
  return lines.join('\n');
}

function buildSummaryOnlyTxt() {
  return `SESJA: ${sessionName}
DATA: ${nowDateTime()}
=====================================

${lastSummary}
`;
}

function buildCombinedTxt() {
  const parts = [];
  parts.push(`SESJA: ${sessionName}`);
  parts.push(`DATA: ${nowDateTime()}`);
  parts.push('=====================================');
  parts.push('');
  parts.push('--- NOTATKI ---');
  parts.push('');
  notes.forEach((n, i) => {
    parts.push(`NOTATKA ${i + 1} [${n.timestamp}]`);
    parts.push(n.text);
    parts.push('');
  });
  parts.push('--- PODSUMOWANIE AI ---');
  parts.push('');
  parts.push(lastSummary);
  return parts.join('\n');
}

function exportNotes() {
  shareText(buildExportTxt(), filenameFor(''));
}

async function shareText(content, filename) {
  try {
    if (typeof File !== 'undefined') {
      const file = new File([content], filename, { type: 'text/plain' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: sessionName });
        return;
      }
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(content);
    toast('Skopiowano do schowka — wklej w wybranej aplikacji');
  } catch {
    toast('Nie udało się udostępnić ani skopiować');
  }
}

function filenameFor(suffix) {
  const slug = slugify(sessionName) || 'sesja';
  const date = nowYMD();
  return `${slug}${suffix}-${date}.txt`;
}

// ===== NEW SESSION =====
function newSession() {
  if (!confirm('Skasować wszystkie notatki i rozpocząć nową sesję?')) return;
  notes = [];
  saveNotes();
  sessionName = defaultSessionName();
  localStorage.setItem(LS.sessionName, sessionName);
  sessionInput.value = sessionName;
  lastSummary = '';
  renderNotes();
  refreshActionPanel();
  toast('Nowa sesja rozpoczęta');
}

// ===== SUMMARIZE MODAL =====
function openSummarizeModal() {
  const key = localStorage.getItem(LS.apiKey);
  if (!key) {
    toast('Przejdź do Ustawień i wpisz klucz API');
    return;
  }
  if (!navigator.onLine) {
    toast('Brak połączenia z API — użyj przycisku Eksportuj i wklej notatki do Claude ręcznie');
    return;
  }

  tplList.innerHTML = '';
  getTemplates().forEach(tpl => {
    const btn = document.createElement('button');
    btn.className = 'tpl-pick';
    btn.textContent = tpl.label;
    btn.addEventListener('click', () => {
      closeSummarizeModal();
      runSummary(tpl.prompt);
    });
    tplList.appendChild(btn);
  });

  customPromptInput.value = localStorage.getItem(LS.customPrompt) || '';
  modalSummarize.classList.remove('hidden');
}

function closeSummarizeModal() {
  stopDictation();
  modalSummarize.classList.add('hidden');
}

function runCustomPrompt() {
  const v = customPromptInput.value.trim();
  if (!v) {
    toast('Wpisz lub podyktuj własne instrukcje');
    return;
  }
  localStorage.setItem(LS.customPrompt, v);
  closeSummarizeModal();
  runSummary(v);
}

// ===== CLAUDE API =====
async function runSummary(promptText) {
  const key = localStorage.getItem(LS.apiKey);
  if (!key) {
    toast('Przejdź do Ustawień i wpisz klucz API');
    return;
  }
  if (!navigator.onLine) {
    toast('Brak połączenia z API — użyj przycisku Eksportuj i wklej notatki do Claude ręcznie');
    return;
  }

  const formattedNotes = notes.map((n, i) => `NOTATKA ${i + 1} [${n.timestamp}]: ${n.text}`).join('\n');
  const prompt = promptText + '\n\n' + formattedNotes;

  spinner.classList.remove('hidden');

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 60000);

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      }),
      signal: ctrl.signal
    });
    clearTimeout(tid);

    if (resp.status === 401) {
      spinner.classList.add('hidden');
      toast('Nieprawidłowy klucz API');
      return;
    }
    if (resp.status === 429) {
      spinner.classList.add('hidden');
      toast('Przekroczono limit zapytań — spróbuj za chwilę');
      return;
    }
    if (!resp.ok) {
      spinner.classList.add('hidden');
      toast(`Błąd API (${resp.status})`);
      return;
    }

    const data = await resp.json();
    const text = (data?.content || []).map(b => b.text || '').join('\n').trim();
    lastSummary = text || '(Pusta odpowiedź modelu)';
    spinner.classList.add('hidden');
    showSummary();
  } catch (err) {
    clearTimeout(tid);
    spinner.classList.add('hidden');
    if (err.name === 'AbortError') {
      toast('Brak połączenia z API — użyj przycisku Eksportuj i wklej notatki do Claude ręcznie');
    } else {
      toast('Brak połączenia z API — użyj przycisku Eksportuj i wklej notatki do Claude ręcznie');
    }
  }
}

function showSummary() {
  summarySession.textContent = sessionName;
  summaryContent.textContent = lastSummary;
  screenMain.classList.add('hidden');
  screenSummary.classList.remove('hidden');
  window.scrollTo(0, 0);
}

function showMain() {
  screenSummary.classList.add('hidden');
  screenMain.classList.remove('hidden');
}

// ===== DICTATION (do textarea własnych instrukcji) =====
function toggleDictateCustomPrompt() {
  if (dictation) stopDictation();
  else startDictation();
}

function startDictation() {
  if (!navigator.onLine) {
    toast('Brak połączenia — dyktowanie wymaga internetu');
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    toast('Twoja przeglądarka nie obsługuje rozpoznawania mowy');
    return;
  }

  const rec = new SR();
  rec.lang = 'pl-PL';
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  const baseText = customPromptInput.value.trim();
  let committed = '';
  let active = true;

  rec.onresult = (ev) => {
    const finalsArr = [];
    let interim = '';
    for (let i = 0; i < ev.results.length; i++) {
      const res = ev.results[i];
      const t = res[0].transcript.trim();
      if (!t) continue;
      if (res.isFinal) finalsArr.push(t);
      else interim += res[0].transcript;
    }
    let merged = '';
    for (const f of finalsArr) {
      if (!merged) { merged = f; continue; }
      const fLow = f.toLowerCase();
      const mLow = merged.toLowerCase();
      if (fLow.startsWith(mLow)) merged = f;
      else if (mLow.endsWith(fLow)) { /* skip */ }
      else merged += ' ' + f;
    }
    const current = (committed + (merged ? merged + ' ' : '') + interim).replace(/\s+/g, ' ').trim();
    customPromptInput.value = (baseText ? baseText + ' ' : '') + current;
  };

  rec.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      toast('Brak dostępu do mikrofonu');
    } else if (e.error === 'network') {
      toast('Błąd sieci — sprawdź internet');
    } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
      toast('Błąd rozpoznawania: ' + e.error);
    }
  };

  rec.onend = () => {
    // Promote merged finals to committed; restart if still active (długie dyktowanie)
    const v = customPromptInput.value;
    const newPart = baseText ? v.slice(baseText.length).trim() : v.trim();
    committed = newPart ? newPart + ' ' : '';
    if (active) {
      try { rec.start(); } catch {}
    } else {
      finalizeDictation();
    }
  };

  try {
    rec.start();
    dictation = {
      rec,
      stop: () => { active = false; try { rec.stop(); } catch {} }
    };
    btnDictatePrompt.classList.add('recording');
    const slotStop = btnDictatePrompt.querySelector('[data-icon]');
    if (slotStop) { slotStop.dataset.icon = 'stop'; paintIcons(btnDictatePrompt); }
  } catch {
    toast('Nie udało się rozpocząć dyktowania');
  }
}

function stopDictation() {
  if (!dictation) return;
  dictation.stop();
}

function finalizeDictation() {
  dictation = null;
  btnDictatePrompt.classList.remove('recording');
  const slotMic = btnDictatePrompt.querySelector('[data-icon]');
  if (slotMic) { slotMic.dataset.icon = 'microphone'; paintIcons(btnDictatePrompt); }
  const v = customPromptInput.value.trim();
  if (v) localStorage.setItem(LS.customPrompt, v);
}

// ===== SETTINGS =====
function openSettings() {
  apiKeyInput.value = localStorage.getItem(LS.apiKey) || '';
  refreshKeyStatus();
  modal.classList.remove('hidden');
}

function closeSettings() {
  modal.classList.add('hidden');
}

function saveKey() {
  const v = apiKeyInput.value.trim();
  if (v) {
    localStorage.setItem(LS.apiKey, v);
    toast('Klucz zapisany');
  } else {
    localStorage.removeItem(LS.apiKey);
    toast('Klucz usunięty');
  }
  refreshKeyStatus();
  closeSettings();
}

function refreshKeyStatus() {
  const has = !!localStorage.getItem(LS.apiKey);
  apiKeyStatus.classList.toggle('status-ok', has);
  apiKeyStatus.classList.toggle('status-warn', !has);
  const slot = apiKeyStatus.querySelector('.icon-slot');
  if (slot) slot.dataset.icon = has ? 'check-circle' : 'alert-circle';
  const txt = apiKeyStatus.querySelector('.api-key-status-text');
  if (txt) txt.textContent = has ? 'Klucz zapisany' : 'Brak klucza';
  paintIcons(apiKeyStatus);
}

// ===== UTIL =====
function defaultSessionName() {
  const d = new Date();
  return `Sesja ${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nowHHMMSS() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function nowDateTime() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nowYMD() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

function slugify(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/gi, 'l')
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9\-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 3500);
}

// ===== SERVICE WORKER =====
function registerSW() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}

init();

})();
