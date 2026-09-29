# Liczbolandia

Kolorowa platformówka z matematyką dla dzieci. Działa w przeglądarce i instaluje się na Androidzie jako aplikacja z ikonką (PWA).

**Graj:** https://bmichal93.github.io/liczbolandia/

## Instalacja na telefonie (Android)

1. Otwórz link powyżej w Chrome.
2. Menu ⋮ → „Dodaj do ekranu głównego” / „Zainstaluj aplikację”.
3. Od teraz gra startuje z ikonki, na pełnym ekranie, także bez internetu.

## Co jest w grze

- 6 światów × (3 poziomy + boss), w każdym świecie nowa mechanika: sprężyny, lód, pływanie, grzyby-trampoliny, znikające chmurki i wiatr, czekoladowa lawa i spadające platformy.
- Matematyka wpleciona w rozgrywkę:
  - **bramy** - skocz głową w klocek z dobrą odpowiedzią,
  - **zbieranie liczb** - suma, parzyste/nieparzyste, wielokrotności, liczby pierwsze, kolejność - nagroda w skrzyni,
  - **bossowie** - pokonuje się ich dobrymi odpowiedziami,
  - **sklep** - promocje i liczenie reszty.
- 3 poziomy matematyki (ok. 6-8, 8-10, 11-13 lat) z automatycznym dopasowaniem trudności.
- 8 postaci o różnych umiejętnościach, kolory, dodatki, ślady, odznaki.
- Osobne profile graczy, automatyczny zapis, kopia zapasowa do pliku lub jako kod.

## Budowa

Czysty HTML/CSS/JS bez bundlera - pliki w `js/` ładowane jako zwykłe skrypty. Grafika rysowana wektorowo na canvasie, dźwięk syntezowany Web Audio. `sw.js` cache'uje wszystkie pliki (tryb offline); przy każdej zmianie plików podbij `VERSION` w `sw.js`, żeby telefony pobrały nową wersję.
