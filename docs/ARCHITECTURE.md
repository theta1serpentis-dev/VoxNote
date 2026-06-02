# VoxNote — Dokumentacja architektury

## Przegląd

VoxNote to single-page PWA napisana w czystym JavaScript (bez frameworków, bez bundlera). Cała logika aplikacji zawarta jest w jednym pliku `app.js` opakowanym w IIFE. Dane przechowywane są wyłącznie w `localStorage` przeglądarki — aplikacja nie ma backendu.

## Stos technologiczny

- **Vanilla JS (ES2020+)** — brak zależności, minimalne przesyłanie danych
- **Web Speech API** — rozpoznawanie mowy po stronie przeglądarki (silnik Google, wymaga internetu)
- **Claude API (Anthropic)** — podsumowania AI; bezpośrednie wywołanie `fetch` z przeglądarki z nagłówkiem `anthropic-dangerous-direct-browser-access: true`
- **localStorage** — jedyny magazyn danych; brak konta użytkownika
- **Service Worker** — cache-first dla zasobów statycznych; API i zasoby zewnętrzne zawsze przez sieć

## Struktura projektu

```
VoxNote/
├── index.html          # UI — trzy ekrany: główny, podsumowania, dwa modale
├── app.js              # Cała logika aplikacji (IIFE, ~710 linii)
├── style.css           # Ciemny motyw, układ mobile-first
├── service-worker.js   # Cache statycznych zasobów (cache-first)
├── manifest.json       # PWA: ikony, kolory, tryb standalone
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
└── docs/
    ├── ARCHITECTURE.md  # Ten plik
    └── IDEAS.md
```

## Architektura danych

### Klucze localStorage

| Klucz | Wartość |
|-------|---------|
| `vn_notes` | JSON — tablica obiektów `{ id, text, timestamp }` |
| `vn_api_key` | String — klucz API Anthropic użytkownika |
| `vn_session_name` | String — nazwa aktualnej sesji nagraniowej |
| `vn_custom_prompt` | String — ostatnio użyty własny prompt |
| `vn_templates` | JSON — tablica szablonów zdefiniowanych przez użytkownika |
| `vn_font_size` | Number — rozmiar czcionki notatek w px (14 lub 16; domyślnie 14) |

### Przepływ danych

```
Głos użytkownika
      │
      ▼
Web Speech API (pl-PL, continuous)
      │  onresult → finalTranscript + interimTranscript
      ▼
livePreview (podgląd w czasie rzeczywistym)
      │
      │  stopRecording()
      ▼
notes[] ──► localStorage (vn_notes)
      │
      │  openSummarizeModal() → wybór szablonu / własny prompt
      ▼
runSummary(promptText)
      │
      ▼
fetch → api.anthropic.com/v1/messages
  model: claude-sonnet-4-20250514
  max_tokens: 1500
      │
      ▼
lastSummary ──► ekran podsumowania
      │
      ▼
shareText() → Web Share API (plik .txt) | clipboard fallback
```

## Moduły logiczne (app.js)

### Stan aplikacji

```js
let notes = []              // tablica notatek z localStorage
let sessionName = ''        // nazwa sesji
let lastSummary = ''        // ostatnie podsumowanie AI (in-memory)
let isRecording = false     // czy trwa nagrywanie
let committedTranscript = ''  // transkrypt zatwierdzony (finalne wyniki)
let finalTranscript = ''    // aktualne finalne wyniki
let interimTranscript = ''  // wyniki wstępne (live preview)
```

### Nagrywanie (`startRecording` / `stopRecording`)

Tworzy instancję `SpeechRecognition` z `continuous: true` i `interimResults: true`. Obsługuje znany quirk Android Chrome: emituje wiele wyników `isFinal=true` z rosnącym prefiksem — kod scala je przez porównanie `startsWith` / `endsWith`.

Po zatrzymaniu transkrypt jest czyszczony ze zbędnych spacji i zapisywany jako nowa notatka z `id = Date.now()` i znacznikiem czasu `HH:MM:SS`.

Przy bardzo długich sesjach Web Speech API może samoczynnie zakończyć rozpoznawanie — `onend` restartuje je automatycznie gdy `isRecording === true`.

### System szablonów

Jeden wbudowany szablon (`BUILTIN_TEMPLATE`) jest stałą w kodzie. Szablony użytkownika przechowywane są w `localStorage`. `getTemplates()` zwraca połączoną tablicę `[builtin, ...custom]`.

### Ustawienia (`openSettings`, `applyFontSize`)

Modal ustawień obsługuje dwa ustawienia użytkownika: klucz API oraz rozmiar czcionki notatek. `applyFontSize(size)` ustawia CSS custom property `--note-font-size` na elemencie `:root` i synchronizuje aktywny przycisk przełącznika. Wartość zapisywana jest natychmiast po kliknięciu przycisku (bez konieczności osobnego Zapisz).

### Wywołanie Claude API (`runSummary`)

```js
async function runSummary(promptText)
// Buduje prompt: promptText + '\n\n' + sklejone notatki
// Wysyła POST do https://api.anthropic.com/v1/messages
// Timeout: 60 sekund (AbortController)
// Obsługuje: 401 (zły klucz), 429 (rate limit), inne błędy sieciowe
```

### Dyktowanie własnego promptu (`startDictation`)

Osobna instancja `SpeechRecognition` działająca równolegle z modalem podsumowania. Pozwala użytkownikowi podyktować instrukcje zamiast wpisywać je ręcznie.

### Service Worker

Strategia **cache-first** dla zasobów statycznych. Każda zmiana zasobów wymaga inkrementacji `CACHE_NAME` (np. `voxnote-v4` → `voxnote-v5`). Zapytania do `api.anthropic.com` i wszelkie cross-origin zawsze omijają cache.

## Punkty rozszerzenia

- **Nowe szablony** — dodać obiekt `{ id, label, prompt }` do `vn_templates` w localStorage; UI renderuje je automatycznie
- **Inny model Claude** — zmienić `model` w `runSummary()` (jeden string)
- **Wiele sesji** — rozbudować `vn_notes` o klucz sesji; UI wymaga nowego ekranu wyboru sesji
- **Eksport do pliku** — użyć `File System Access API` zamiast Web Share / clipboard fallback
- **Backend** — jedyny punkt wejścia to `runSummary()`; można zastąpić `fetch` wywołaniem własnego endpointu
