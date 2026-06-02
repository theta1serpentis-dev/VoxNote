# VoxNote — Pomysły na rozwój

## Nowe funkcje

### [Wysoki] Wiele zapisanych sesji z historią

Aktualnie `vn_notes` przechowuje tylko bieżącą sesję; „Nowa sesja" kasuje poprzednią bezpowrotnie. Dodanie listy sesji (tablica w localStorage, każda z `id`, `name`, `date`, `notes[]`) umożliwiłoby przeglądanie i ponowne podsumowywanie starszych nagrań.
Punkt wejścia: `newSession()` w `app.js` i klucz `vn_sessions` w localStorage.

### [Wysoki] Zarządzanie szablonami w UI

Szablony użytkownika (`vn_templates`) są już obsługiwane w kodzie, ale nie ma UI do ich tworzenia, edytowania ani usuwania. Prosty ekran/modal „Moje szablony" z listą, polem nazwy i textarea promptu wystarczy.
Punkt wejścia: `getTemplates()` i klucz `vn_templates`.

### [Wysoki] Edycja notatki przed zapisem

Po zatrzymaniu nagrywania transkrypt jest zapisywany natychmiast. Dodanie krótkiego okna (np. 3 s) z możliwością edycji lub anulowania pozwoliłoby korygować błędy rozpoznawania bez ręcznego usuwania i ponownego nagrywania.

### [Średni] Streaming odpowiedzi Claude

Aktualnie `runSummary()` czeka na pełną odpowiedź API (do 60 s). Zmiana na streaming (`stream: true`, SSE) pozwoliłaby wyświetlać tekst podsumowania przyrostowo — użytkownik widzi postęp zamiast spinnera.
Punkt wejścia: `runSummary()` — zamienić `resp.json()` na iterację po `ReadableStream`.

### [Średni] Udostępnianie do konkretnych aplikacji (Notion, Keep)

Aktualnie eksport trafia do ogólnego menu systemowego lub schowka. Dodanie gotowych przycisków „Wyślij do Notion" / „Wyślij do Google Keep" (przez deep-link lub API) skróciłoby przepływ pracy.

### [Średni] Podgląd i kopiowanie pojedynczej notatki

Lista notatek pokazuje tekst, ale nie ma możliwości dotknięcia notatki, żeby ją skopiować lub edytować. Prosta akcja `tap → kopiuj do schowka` na elemencie `li.note-item` byłaby przydatna.

### [Niski] Tryb offline z kolejką

Nagrywanie jest blokowane bez internetu (Web Speech API wymaga sieci). Można dodać informację o tym ograniczeniu oraz alternatywny tryb ręcznego wpisywania tekstu, który działa offline.

### [Niski] Eksport jako Markdown

Aktualnie eksport generuje plain text. Dodanie formatu `.md` (nagłówki, listy punktowane) ułatwiłoby wklejanie do Obsidian, Notion czy GitHub.
Punkt wejścia: `buildExportTxt()` / `buildCombinedTxt()`.

### [Niski] Skrót głosowy do nowej sesji

Dodanie rozpoznawania komendy głosowej (np. „nowa sesja") podczas nagrywania, która wywołałaby `newSession()` bez konieczności dotykania ekranu.

### [Średni] Nowoczesna ikona aplikacji

Aktualna ikona PWA (pliki `icon-192.png` / `icon-512.png` z `manifest.json`) ma uproszczoną grafikę. Przeprojektowanie jej jako minimalistyczna forma — np. stylizowany mikrofon z falą dźwiękową lub połączenie bąbelka mowy z symbolem AI — poprawiłoby rozpoznawalność na ekranie domowym i w przełączniku aplikacji. Nowa ikona powinna być dostarczona w wersjach SVG (źródło) oraz PNG 192/512 px i uwzględniać `maskable` wariant do adaptacyjnych ikon Androida (pole `"purpose": "maskable"` w `manifest.json`).

### [Średni] Modal z instrukcją obsługi

Nowi użytkownicy nie wiedzą, że muszą wpisać klucz API ani jak korzystać z szablonów. Dodanie przycisku pomocy (ikona `?` w nagłówku) otwierającego modal z instrukcją krok po kroku: 1) pobierz klucz API z Anthropic Console, 2) wklej go w Ustawieniach, 3) zacznij nagrywać, 4) wygeneruj podsumowanie. Modal wyświetlany automatycznie przy pierwszym uruchomieniu (`localStorage` flaga `vn_onboarding_shown`) i dostępny ręcznie w dowolnym momencie. Implementacja: nowy element `<dialog id="help-modal">` w `index.html` + handler w `app.js`.

## Usprawnienia

### [Wysoki] Informacja o limicie localStorage

localStorage ma limit ~5 MB. Przy intensywnym użyciu (wiele długich sesji) aplikacja może cicho przestać zapisywać notatki. Warto dodać `try/catch` wokół `saveNotes()` z czytelnym komunikatem błędu.

### [Średni] Lepsze komunikaty o błędach API

Aktualnie wszystkie błędy sieciowe w `runSummary()` pokazują ten sam komunikat. Warto rozróżnić: brak internetu, timeout, błąd 5xx po stronie Anthropic.

### [Niski] Animacja przycisku nagrywania

Przycisk ma klasy CSS `rec-idle` / `rec-initializing` / `rec-recording`, ale pulsowanie jest statyczne. Subtelna animacja (`scale` lub `box-shadow` pulse) poprawiłaby odczucie „żywości" interfejsu.

## Refaktoryzacja

### [Średni] Wyodrębnienie modułu speechRecognition

Logika rozpoznawania mowy jest zduplikowana: raz w `startRecording()`, raz w `startDictation()`. Wspólna funkcja fabryczna `createRecognition({ onResult, onError, onEnd })` usunęłaby duplikację i uprościła oba miejsca.

### [Niski] Zastąpienie `confirm()` własnym modalem

`newSession()` używa natywnego `confirm()`, które na mobile wygląda niespójnie. Prosty modal potwierdzenia w stylu aplikacji byłby lepszy.
