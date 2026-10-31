# Cliplet

Ett litet tillägg för lokal urklippshistorik i **GNOME Shell 51 på Wayland**.
UUID: `cliplet@hogbergmarkus.github.io`. Andra GNOME-versioner stöds inte.

Cliplet sparar kopierad text i en meny i toppanelen. Klicka för att kopiera igen,
radera enskilda poster eller töm historiken. Historiklängden är 5–25 poster
(standard 15), och insamlingen kan pausas. Historik och inställningar sparas
mellan omstarter. Bilder, filer och markerad text i PRIMARY samlas inte in.
Insamlingen börjar med nästa kopiering efter aktivering eller återupptagning.

**Engelska och svenska stöds automatiskt via systemets språk**, med engelska som
fallback. Ingen separat språkinställning behövs.

Detta är ett personligt hobbyprojekt som sparas här för framtida återinstallation.
Det finns **inga garantier om underhåll, support, uppdateringar eller framtida
kompatibilitet**. Publicering på GNOME Extensions är inte planerad.

## Installera från ZIP

1. Hämta `cliplet@hogbergmarkus.github.io.shell-extension.zip` från
   [GitHub Releases](https://github.com/hogbergmarkus/cliplet/releases).
   Välj installationspaketet, inte GitHubs automatiska källkodsarkiv.
2. Kör i katalogen där ZIP-filen ligger (utan sudo):

   ```sh
   gnome-extensions install cliplet@hogbergmarkus.github.io.shell-extension.zip
   ```

   Om Cliplet redan är installerat: använd `gnome-extensions install --force`
   med samma ZIP-fil för att ersätta tillägget. Historik och inställningar behålls.
3. **Logga ut och in igen**, och aktivera sedan:

   ```sh
   gnome-extensions enable cliplet@hogbergmarkus.github.io
   ```

Paketet innehåller runtime-moduler, GSettings-schema och kompilerad svensk
översättning. Python, Babel och andra separata byggverktyg behövs inte vid
installation eller användning.

Inställningar öppnas från menyn eller med:

```sh
gnome-extensions prefs cliplet@hogbergmarkus.github.io
```

Om tillägget inte syns, kontrollera GNOME-versionen med `gnome-shell --version`,
logga ut/in och kör `gnome-extensions info cliplet@hogbergmarkus.github.io`.
Om ingen text samlas in, kontrollera pausläget och kopiera en ny text.

## Installera från källkod

Bygget kräver `gnome-extensions`, GLib:s `glib-compile-schemas`, Python 3 och Babel
(på Ubuntu: `python3-babel`). Kör i projektkatalogen:

```sh
sh scripts/package.sh
gnome-extensions install dist/cliplet@hogbergmarkus.github.io.shell-extension.zip
```

Logga sedan ut/in och aktivera enligt ovan. Se [DEVELOPMENT.md](DEVELOPMENT.md)
för tester och översättningsbygge.

## Integritet

Ingen nätverkskommunikation eller telemetri används. Historiken sparas i klartext i
`${XDG_DATA_HOME:-$HOME/.local/share}/cliplet/history.json`, med rättighet 0700
på katalogen och 0600 på filen. **Även kopierade lösenord kan sparas**; pausa
insamlingen innan du kopierar känslig text.

**Töm historik** raderar historiklistan och tömmer aktuellt urklipp, även under paus.
Radering av en enskild post ändrar inte urklippet. Radering är inte säker
överskrivning av lagringsmediet och tar inte bort externa säkerhetskopior.
Lagringsfel visas i menyn; då kan äldre historik finnas kvar på disk.

## Avinstallera

```sh
gnome-extensions disable cliplet@hogbergmarkus.github.io
gnome-extensions uninstall cliplet@hogbergmarkus.github.io
```

Sparad historik och inställningar lämnas kvar för en eventuell återinstallation.

## Licens

[MIT](LICENSE), Copyright (c) 2026 Markus Högberg.
Licensen innebär inget åtagande om framtida underhåll eller support.
