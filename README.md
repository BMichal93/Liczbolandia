# Liczbolandia

Kolorowa platformówka z matematyką dla dzieci. Działa w przeglądarce i instaluje się na Androidzie jako aplikacja z ikonką (PWA).

**Graj:** https://bmichal93.github.io/Liczbolandia/

## Udostępnianie - kod QR

Zeskanuj kod aparatem telefonu z Androidem i dotknij „Zainstaluj grę” (strona `install.html`). W grze: **Udostępnij grę** (menu główne, ustawienia) pokazuje ten kod na ekranie i pozwala wysłać link (WhatsApp, Messenger, SMS). Plakat do wydruku: `liczbolandia-plakat-qr.pdf`.

![Kod QR](qr.png)

## Instalacja na telefonie (Android)

1. Otwórz link powyżej w Chrome.
2. Menu ⋮ → „Dodaj do ekranu głównego” / „Zainstaluj aplikację”.
3. Od teraz gra startuje z ikonki, na pełnym ekranie, także bez internetu.

Działa na telefonie, tablecie i laptopie - widok i menu dopasowują się do ekranu. Na laptopie Chrome/Edge też pozwala zainstalować grę (ikonka w pasku adresu).

## Co jest w grze

- 6 światów × (3 poziomy + boss), w każdym świecie nowa mechanika: sprężyny, lód, pływanie, grzyby-trampoliny, znikające chmurki i wiatr, czekoladowa lawa i spadające platformy.
- Matematyka wpleciona w rozgrywkę:
  - **bramy** - skocz głową w klocek z dobrą odpowiedzią,
  - **zbieranie liczb** - suma, parzyste/nieparzyste, kolejność, liczby z tabliczki mnożenia - nagroda w skrzyni,
  - **bossowie** - pokonuje się ich dobrymi odpowiedziami,
  - **sklep** - promocje i liczenie reszty (w zakresie do 100).
- Tylko dodawanie, odejmowanie, mnożenie i dzielenie, liczby od 0 do 100, bez liczb ujemnych. 4 poziomy trudności:
  - **Łatwy** (nagrody ×1) - dodawanie i odejmowanie do 20, z kropkami do liczenia,
  - **Średni** (×1,5) - dodawanie i odejmowanie do 100,
  - **Trudny** (×2) - do 100 + mnożenie i dzielenie do 50,
  - **Mistrzowski** (×3) - cała tabliczka mnożenia i dzielenie do 100.
  W ramach poziomu gra sama dopasowuje zadania do dziecka.
- 9 postaci o różnych umiejętnościach (w tym Świnka Kuleczka - wysokie odbicie od przeciwników), kolory, dodatki, ślady, odznaki.
- Osobne profile graczy, automatyczny zapis, kopia zapasowa do pliku lub jako kod.

## Budowa

Czysty HTML/CSS/JS bez bundlera - pliki w `js/` ładowane jako zwykłe skrypty. Grafika rysowana wektorowo na canvasie, dźwięk syntezowany Web Audio. `sw.js` cache'uje wszystkie pliki (tryb offline); przy każdej zmianie plików podbij `VERSION` w `sw.js`, żeby telefony pobrały nową wersję.

## Publikowanie zmian

Strona jest serwowana z gałęzi `gh-pages` (GitHub włączył Pages automatycznie po jej utworzeniu). Po zmianach w `main`:

```
git push origin main && git push origin main:gh-pages
```
