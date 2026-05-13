# VoxNote — CLAUDE.md

## Na początku każdej konwersacji

Przed podjęciem jakichkolwiek działań przeczytaj dogłębnie następujące pliki:

1. `app.js` — pełna logika aplikacji
2. `index.html` — struktura UI i identyfikatory elementów DOM
3. `style.css` — motyw i layout
4. `service-worker.js` — strategia cache

Bez znajomości aktualnego stanu kodu nie proponuj zmian ani nie odpowiadaj na pytania o implementację.

---

## Przegląd projektu

VoxNote to progresywna aplikacja webowa (PWA) do nagrywania notatek głosowych w języku polskim z AI-generowanym podsumowaniem. Działa w całości po stronie klienta — brak backendu, brak systemu budowania, brak zależności npm.

## Stos technologiczny

- **Vanilla JS** — zero frameworków, zero zależności
- **Web Speech API** — rozpoznawanie mowy w czasie rzeczywistym
- **Claude API (Anthropic)** — podsumowania AI; klucz API przechowywany lokalnie przez użytkownika
- **localStorage** — trwały magazyn notatek, szablonów, klucza API
- **PWA** — service worker + manifest, działa offline po pierwszym załadowaniu

## Pliki projektu

| Plik | Rola |
|------|------|
| `app.js` | Cała logika: nagrywanie, localStorage, wywołania Claude API, szablony, eksport |
| `index.html` | Trzy ekrany: główny (nagrywanie), widok podsumowania, modal ustawień |
| `style.css` | Ciemny motyw, interfejs zoptymalizowany pod dotyk / mobile |
| `service-worker.js` | Cache statycznych zasobów; pomija żądania do zewnętrznych API |
| `manifest.json` | Konfiguracja PWA, ikony 192/512 px |

## Architektura danych

Wszystko trafia do `localStorage`:

- `voxnoteNotes` — tablica JSON notatek z danej sesji
- `sessionName` — nazwa aktualnej sesji nagraniowej
- `claudeApiKey` — klucz API użytkownika (nigdy nie opuszcza przeglądarki)
- `customPrompt` / `customTemplates` — szablony podsumowań

## Przepływ danych

```
Głos → Web Speech API → live preview → localStorage
                                            ↓
                            Wybór szablonu + wywołanie Claude API
                                            ↓
                                  Ekran podsumowania → Share / Schowek
```

## Zasady pracy z kodem

### Czego nie robić
- **Nie dodawaj zależności npm** — projekt celowo nie ma `package.json`; każda funkcja musi być zaimplementowana w vanilla JS lub jako wywołanie zewnętrznego API.
- **Nie wprowadzaj systemu budowania** (Webpack, Vite itp.) bez wyraźnego polecenia.
- **Nie przenoś kluczy API** do kodu — klucz Claude musi pozostać po stronie użytkownika (localStorage).
- **Nie używaj anglojęzycznych stringów UI** — cały interfejs jest po polsku.

### Czego przestrzegać
- Aplikacja musi działać na HTTPS (wymaga tego Web Speech API i Web Share API).
- Lokalne testy: dowolny serwer HTTP (`python -m http.server`, Live Server w VS Code itp.).
- Zmiany w `service-worker.js` wymagają inkrementacji numeru wersji cache, żeby przeglądarka pobrała nowy plik.
- Projekt jest dostosowany do urządzeń mobilnych — każdą zmianę UI testuj na wąskim widoku.

## Wywołania Claude API

Model: `claude-opus-4-5` (lub nowszy) — patrz wywołanie `fetch` w `app.js`.

Prompt wysyłany do API składa się z:
1. Szablonu podsumowania wybranego przez użytkownika (wbudowany lub własny)
2. Sklejonych notatek z bieżącej sesji

Klucz API jest pobierany z `localStorage` i przekazywany w nagłówku `x-api-key`. Nigdy nie loguj go do konsoli.

## Uruchamianie lokalnie

```bash
# Python (dowolna wersja)
python -m http.server 8080

# Node.js
npx serve .
```

Następnie otwórz `http://localhost:8080` w przeglądarce (Chrome/Edge rekomendowany dla Web Speech API).

## Wdrożenie

GitHub Pages: push na gałąź `main` → Pages włączone w ustawieniach repozytorium. Aplikacja dostępna pod `https://<user>.github.io/<repo>/`.

## Testowanie

Brak automatycznych testów. Przed zgłoszeniem zmiany sprawdź ręcznie:
- [ ] Nagrywanie i zatrzymywanie działa poprawnie
- [ ] Notatki zapisują się do localStorage i odtwarzają po odświeżeniu
- [ ] Wywołanie Claude API zwraca podsumowanie i wyświetla je na ekranie
- [ ] Eksport (Share / Schowek) działa
- [ ] Ustawienia (klucz API, szablony) zapisują się i ładują poprawnie
- [ ] Aplikacja działa offline po pierwszym załadowaniu (service worker)
