# VoxNote

Progresywna aplikacja webowa (PWA) do zbierania notatek głosowych jednym przyciskiem,
z opcjonalnym podsumowaniem przez Claude AI. Zoptymalizowana pod Androida w trybie
jednoręcznym.

## Funkcje

- Nagrywanie głosu jednym przyciskiem (Web Speech API, język polski)
- Notatki przechowywane lokalnie w przeglądarce (localStorage) — brak konta, brak serwera
- Podsumowanie AI przez Claude API z szablonem wbudowanym lub własnym promptem
- Dyktowanie własnych instrukcji do podsumowania (głosowe wpisywanie promptu)
- Eksport / udostępnianie przez systemowe menu Androida lub schowek (fallback)
- Ciemny motyw, duże elementy dotykowe, tryb jednoręczny
- Działa offline po pierwszym załadowaniu (cache zasobów przez service worker)

## Szybki start

```bash
# Lokalnie (Python)
python -m http.server 8080

# Lokalnie (Node.js)
npx serve .
```

Otwórz `http://localhost:8080`. Chrome / Edge zalecane (pełne wsparcie Web Speech API).

## Użycie

| Akcja | Opis |
|-------|------|
| Naciśnij duży przycisk | Rozpocznij nagrywanie |
| Naciśnij ponownie | Zatrzymaj i zapisz notatkę |
| ✨ Podsumuj przez AI | Wyślij notatki do Claude, wybierz szablon |
| 📤 Eksportuj notatki | Udostępnij surowe notatki jako plik .txt |
| 🗑️ Nowa sesja | Wyczyść notatki i zacznij od nowa |
| ⚙️ Ustawienia | Wpisz / zmień klucz API Claude |

## Dokumentacja techniczna

Szczegóły architektury: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
Pomysły na rozwój: [docs/IDEAS.md](docs/IDEAS.md)

---

## 1. Deployment na GitHub Pages

1. Sforkuj lub utwórz nowe repozytorium z plikami z tego katalogu.
2. Wypchnij wszystkie pliki na branch `main`.
3. W repozytorium na GitHub: **Settings → Pages**.
4. **Source**: `Deploy from a branch`, **Branch**: `main`, **Folder**: `/ (root)`.
5. Zapisz. Po chwili aplikacja będzie dostępna pod adresem
   `https://<twoja-nazwa>.github.io/<repo>/`.

> Uwaga: Web Speech API i Web Share API wymagają HTTPS — GitHub Pages serwuje HTTPS
> domyślnie, więc wszystko zadziała.

## 2. Instalacja na ekranie głównym (Android, Chrome)

1. Otwórz aplikację w Chrome na Androidzie.
2. Menu (⋮) → **Dodaj do ekranu głównego** (lub **Zainstaluj aplikację**).
3. Potwierdź. Ikona pojawi się na pulpicie i będzie działać w trybie pełnoekranowym
   (standalone), bez paska adresu.

## 3. Klucz API Claude

Aby działała funkcja **✨ Podsumuj przez AI**, potrzebny jest klucz API Anthropic:

1. Wejdź na [console.anthropic.com](https://console.anthropic.com).
2. Załóż konto / zaloguj się i doładuj saldo (płatność wymagana do korzystania z API).
3. **API Keys → Create Key**, skopiuj klucz `sk-ant-...`.
4. W aplikacji: ⚙️ (góra prawy róg) → wklej klucz → **Zapisz**.

Klucz przechowywany jest **wyłącznie lokalnie w Twojej przeglądarce** (localStorage).
Aplikacja nie wysyła go nigdzie poza bezpośrednie zapytania do
`api.anthropic.com`. Jeśli czyścisz dane przeglądarki — klucz zostanie usunięty.

## 4. Ograniczenia

- **Web Speech API wymaga internetu** — rozpoznawanie mowy odbywa się po stronie
  serwerów Google (w Chrome). Bez połączenia nagrywanie jest zablokowane.
- **Wsparcie przeglądarek**: najlepiej działa w Chrome / Edge / Samsung Internet
  na Androidzie. Safari na iOS ma ograniczone wsparcie SpeechRecognition.
- **Klucz API jest widoczny w DevTools** użytkownika — to z natury
  klucz osobisty, używaj wyłącznie własnego.
- **Web Share API** z plikami działa na Androidzie i nowych Chrome desktop;
  jeśli niedostępne — fallback do schowka.

## 5. Pliki

- `index.html` — UI
- `style.css` — ciemny motyw, layout jednoręczny
- `app.js` — logika (nagrywanie, eksport, share, integracja Claude)
- `manifest.json` — PWA manifest
- `service-worker.js` — cache zasobów statycznych
- `icons/` — ikony 192 / 512 px

## Licencja

Kod do dowolnego użytku (MIT-style). Brak gwarancji.
 