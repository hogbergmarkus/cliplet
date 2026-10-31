# Utveckling och paketering

Projektet har inga externa runtime-beroenden utöver GNOME. Behåll samma UUID,
GSettings-schema och dataplats vid framtida ändringar för att kunna återanvända
sparade inställningar och historik.

## Bygg installationspaketet

Kräver `gnome-extensions`, `glib-compile-schemas`, Python 3 och Babel.

```sh
sh scripts/package.sh
```

Skriptet bygger översättningen och använder GNOMEs officiella
`gnome-extensions pack` med en tillfällig katalog och en uttrycklig fillista.
Resultatet ligger i `dist/cliplet@hogbergmarkus.github.io.shell-extension.zip`.
Bygget installerar eller aktiverar inte tillägget. ZIP-tidsstämplar kan variera
mellan byggen; samma källkod ger samma runtime-innehåll.

## Tester

GJS och en svensk UTF-8-locale (t.ex. `sv_SE.UTF-8`, se `locale -a`) behövs också.
Kör från projektroten:

```sh
python3 scripts/translations.py build
glib-compile-schemas --strict schemas
gjs -m tests/validate.js
python3 tests/translations.py
```

Testerna täcker syntax, metadata, GSettings, historikregler, MIME-filter,
asynkron lagring, rättigheter, radering, paus, sena urklippssvar och skydd mot
samtidig körning av det gamla UUID:t. Språktesterna kör riktiga gettext-uppslag
för svenska, engelska och fallback, samt testar inställningsdialogens texter.
Testdata skrivs i ignorerade `.test-output/`; ditt urklipp används inte.

Efter ändringar i gränssnitt eller beteende behövs även kontroll i en riktig
GNOME 51/Wayland-session: kopiering, återkopiering, deduplicering, radering,
tömning, paus, historiklängd och bevarad historik efter utloggning.
Detta kan ändra historik och ska göras med särskilda testdata.

## Översättningar

Engelska originalsträngar finns i källkoden, svenska i `po/sv.po`.

```sh
# Efter ändrade originalsträngar: uppdatera mallen och redigera po/sv.po.
python3 scripts/translations.py pot
python3 scripts/translations.py build
```

Bygget avvisar saknade, tomma och fuzzy-markerade översättningar. Kompilerade
MO-filer i `locale/` inkluderas i ZIP-paketet men inte i Git.

## Källkod

- `extension.js`: panel, meny och urklippshändelser.
- `history.js`: historikregler.
- `storage.js`: asynkron lagring med seriell skrivkö.
- `prefs.js`: inställningsdialog och GSettings-bindningar.

Skyddet mot samtidig körning av `cliplet@local` är kvar av kompatibilitetsskäl.
Om detta gamla tillägg finns installerat måste det avinstalleras och sessionen
startas om innan nuvarande Cliplet kan aktiveras. Dataplats och schema är samma.
