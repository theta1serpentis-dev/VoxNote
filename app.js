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
  template: 'vn_template'
};

const TEMPLATES = {
  lawyer: {
    label: '💼 Spotkanie',
    prompt: `Przeanalizuj poniższe notatki głosowe ze spotkania i przygotuj zwięzłe podsumowanie po polsku według struktury:

📅 INFORMACJE PODSTAWOWE
- Uczestnicy (jeśli wspomniani):
- Temat spotkania:

⚖️ KLUCZOWE USTALENIA I FAKTY

📋 ZOBOWIĄZANIA STRON

⏰ TERMINY I DATY

❓ KWESTIE OTWARTE / NIEJASNOŚCI

➡️ NASTĘPNE KROKI

⚠️ UWAGI DODATKOWE

Używaj punktów. Pomijaj sekcje, które nie mają treści. Oto notatki:`
  },
  trip: {
    label: '📝 Notatki',
    prompt: `Przeanalizuj poniższe notatki głosowe i przygotuj czytelne podsumowanie po polsku według struktury:

📍 MIEJSCE I KONTEKST

🌟 NAJWAŻNIEJSZE DO ZAPAMIĘTANIA (max 5 punktów)

📝 PRZEBIEG CHRONOLOGICZNY

💡 PRAKTYCZNE INFORMACJE
(nazwy, liczby, adresy, ceny, godziny)

❤️ OSOBISTE REFLEKSJE I OCENY

🔍 DO SPRAWDZENIA PÓŹNIEJ

Używaj punktów. Pomijaj sekcje, które nie mają treści. Oto notatki:`
  }
};

// ===== STATE =====
let notes = loadNotes();
let sessionName = localStorage.getItem(LS.sessionName) || defaultSessionName();
let templateKey = localStorage.getItem(LS.template) || 'lawyer';
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
const summaryTemplate = $('summary-template');
const btnBack = $('btn-back');
const btnBackBottom = $('btn-back-bottom');
const btnShareSummary = $('btn-share-summary');
const btnShareAll = $('btn-share-all');

// ===== INIT =====
function init() {
  sessionInput.value = sessionName;
  setActiveTemplate(templateKey);
  renderNotes();
  refreshActionPanel();
  refreshKeyStatus();
  bindEvents();
  registerSW();
}

function bindEvents() {
  sessionInput.addEventListener('change', () => {
    sessionName = sessionInput.value.trim() || defaultSessionName();
    sessionInput.value = sessionName;
    localStorage.setItem(LS.sessionName, sessionName);
  });

  document.querySelectorAll('.tpl-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      templateKey = btn.dataset.tpl;
      localStorage.setItem(LS.template, templateKey);
      setActiveTemplate(templateKey);
    });
  });

  recBtn.addEventListener('click', toggleRecording);

  btnSummarize.addEventListener('click', summarize);
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

// ===== TEMPLATES UI =====
function setActiveTemplate(key) {
  document.querySelectorAll('.tpl-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tpl === key);
  });
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
      <button class="note-del" aria-label="Usuń notatkę">🗑️</button>
    `;
    li.querySelector('.note-text').textContent = n.text;
    li.querySelector('.note-del').addEventListener('click', () => deleteNote(n.id));
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
    let finals = '';
    let interim = '';
    for (let i = 0; i < ev.results.length; i++) {
      const res = ev.results[i];
      const t = res[0].transcript;
      if (res.isFinal) finals += t + ' ';
      else interim += t;
    }
    finalTranscript = finals;
    interimTranscript = interim;
    livePreview.textContent = (committedTranscript + finalTranscript + interimTranscript).trim();
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
    setRecUI(true);
  } catch (err) {
    toast('Nie udało się rozpocząć nagrywania');
  }
}

function stopRecording() {
  isRecording = false;
  try { recognition && recognition.stop(); } catch {}
  setRecUI(false);

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

function setRecUI(rec) {
  recBtn.classList.toggle('rec-recording', rec);
  recBtn.classList.toggle('rec-idle', !rec);
  recLabel.textContent = rec ? 'Nagrywa...' : 'Naciśnij';
}

// ===== EXPORT / SHARE =====
function buildExportTxt() {
  const lines = [];
  lines.push(`SESJA: ${sessionName}`);
  lines.push(`DATA: ${nowDateTime()}`);
  lines.push(`SZABLON: ${TEMPLATES[templateKey].label}`);
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

// ===== CLAUDE API =====
async function summarize() {
  const key = localStorage.getItem(LS.apiKey);
  if (!key) {
    toast('Przejdź do ⚙️ Ustawień i wpisz klucz API');
    return;
  }
  if (!navigator.onLine) {
    toast('Brak połączenia z API — użyj przycisku Eksportuj i wklej notatki do Claude ręcznie');
    return;
  }

  const formattedNotes = notes.map((n, i) => `NOTATKA ${i + 1} [${n.timestamp}]: ${n.text}`).join('\n');
  const prompt = TEMPLATES[templateKey].prompt + '\n\n' + formattedNotes;

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
  summaryTemplate.textContent = TEMPLATES[templateKey].label;
  summaryContent.textContent = lastSummary;
  screenMain.classList.add('hidden');
  screenSummary.classList.remove('hidden');
  window.scrollTo(0, 0);
}

function showMain() {
  screenSummary.classList.add('hidden');
  screenMain.classList.remove('hidden');
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
    toast('✅ Klucz zapisany');
  } else {
    localStorage.removeItem(LS.apiKey);
    toast('Klucz usunięty');
  }
  refreshKeyStatus();
  closeSettings();
}

function refreshKeyStatus() {
  const has = !!localStorage.getItem(LS.apiKey);
  apiKeyStatus.textContent = has ? '✅ Klucz zapisany' : '⚠️ Brak klucza';
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
