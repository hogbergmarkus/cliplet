# Cliplet

Minimalistisk urklippshistorik för **GNOME Shell 51 på Wayland**, UUID `cliplet@local`.
JavaScript med ES-moduler, GNOMEs egna komponenter och inga externa runtime-beroenden.
Alla gränssnittstexter är på svenska.

## Funktioner

- Symbolisk urklippsikon i toppanelen och en rullningsbar meny som följer Shell-temat.
- Endast text från **CLIPBOARD**, aldrig PRIMARY. Kopierade filer och bilder ignoreras.
- Senaste texten överst, inga dubbletter, 5–25 poster (standard 15).
- Klicka på textraden för att kopiera och stänga menyn. X raderar direkt.
- **Töm historik** längst ner rensar historiken och CLIPBOARD utan bekräftelse.
- **Inställningar** öppnar en Adwaita-dialog för historiklängd och paus.
- Historiken sparas mellan utloggningar och omstarter. Pausinställningen sparas också.

Insamlingen börjar med nästa kopiering efter aktivering eller återupptagning.
Befintligt urklippsinnehåll läses inte automatiskt vid start eller när paus avslutas;
därmed återställs inte rensade poster av enbart en omstart.
Under paus kan sparade texter fortfarande återkopieras, raderas och tömmas.
En minskning av historiklängden tar omedelbart bort de äldsta överskjutande posterna.

## Integritet och lagring

Historiken ligger i `${XDG_DATA_HOME:-$HOME/.local/share}/cliplet/history.json`.
Katalogen har rättighet **0700**, filen **0600**. JSON-filen innehåller klartext och är
inte krypterad. Ingen nätverkskommunikation, telemetri eller loggning av urklippsinnehåll sker.

**Kopierade lösenord och annan känslig text kan sparas.** Vanlig urklippsövervakning
kan inte säkert identifiera alla hemligheter. Pausa insamlingen innan du kopierar
sådan information. Andra processer med ditt användarkonto kan läsa filen.

Radering och tömning uppdaterar minnet direkt och köar en atomisk, asynkron ersättning
av historikfilen utan backupfil. Tömning sparar en tom lista. Detta är inte säker
överskrivning av lagringsmediet och tar inte bort säkerhetskopior från andra program.
**Töm historik** ersätter även det aktuella CLIPBOARD-innehållet med tom text,
även under paus. PRIMARY-selection påverkas inte. Radering av en enskild post
ändrar inte systemurklippet. Skrivfel visas i menyn; då kan gamla poster fortfarande finnas på disk.
Nästa ändring försöker spara igen. En plötslig strömförlust innan en skrivning är klar
kan förlora den senaste ändringen.

## Validera i projektkatalogen

Öppna en terminal i den klonade eller uppackade projektkatalogen (där `metadata.json`
finns). Du behöver GNOME Shell 51, GJS och `glib-compile-schemas` från GLib.

```sh
glib-compile-schemas --strict schemas
gjs -m tests/validate.js
```

Testerna kontrollerar JS-modulsyntax med GJS, metadata, GSettings-intervall och standard,
dubbletter, originaltext, MIME-filter, lagring, rättigheter, radering, korrupt JSON och
försenade urklippssvar vid radering, paus och disable. Tömning testas även med
CLIPBOARD-händelser, äldre köade skrivningar, paus och efterföljande kopiering.
Testdata skrivs endast i
projektets ignorerade `.test-output/`. GNOME Shell-UI behöver dessutom testas i en
riktig session efter installation. Testerna läser inte ditt urklipp.

## Installation

Kör från projektkatalogen i en terminal. Kommandona installerar enbart runtime-filer
för din användare och fungerar även när `XDG_DATA_HOME` är anpassad. Ingen sudo behövs.
Installationen ersätter en eventuell tidigare Cliplet-version men behåller dess historik.

```sh
(
  set -eu
  glib-compile-schemas --strict schemas
  cliplet_dest="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/cliplet@local"
  install -d "$cliplet_dest/schemas"
  install -m 644 metadata.json extension.js history.js storage.js prefs.js stylesheet.css LICENSE \
    "$cliplet_dest/"
  install -m 644 schemas/org.gnome.shell.extensions.cliplet.gschema.xml schemas/gschemas.compiled \
    "$cliplet_dest/schemas/"
)
```

Logga därefter **ut och in igen** så att Shell upptäcker det nya tillägget. Under
Wayland kan Shell inte startas om med Alt+F2 → r. Aktivera sedan:

```sh
gnome-extensions enable cliplet@local
gnome-extensions info cliplet@local
gnome-extensions prefs cliplet@local
```

## Verifiera i Wayland-sessionen

1. Kontrollera `echo "$XDG_SESSION_TYPE"` (ska vara `wayland`) och `gnome-shell --version` (51).
2. Kopiera två olika texter med Ctrl+C från en textredigerare. Öppna panelikonen:
   den senaste ska ligga överst. Markering utan Ctrl+C ska inte skapa någon post.
3. Kopiera den första texten igen. Den ska flyttas överst utan en extra kopia.
4. Klicka på en rad och klistra in med Ctrl+V. Menyn ska stängas och hela texten,
   inklusive ursprungliga radbrytningar och blanksteg, ska klistras in.
5. Kopiera en lång flerradig text. Förhandsvisningen ska vara en trunkerad rad.
   Prova även kopiering från en XWayland-app om du använder sådana.
6. Kopiera en bild och en fil i Filer. Ingen ny post ska skapas.
7. Klicka på X. Posten ska försvinna utan att återkopieras; menyn ska förbli öppen.
8. Ändra längden till 5, kopiera sex olika texter och kontrollera att bara fem finns.
   Prova 25 poster och rulla menyn. Testa också tabbnavigering, Enter och X-knappens fokus.
9. Pausa, kopiera text och kontrollera att inget läggs till. Återuppta:
   texten från pausen ska inte läggas till förrän den kopieras igen.
10. Radera en post, logga ut/in och kontrollera att övrig historik finns kvar och den
    raderade posten saknas. Prova därefter **Töm historik**: Ctrl+V i ett tomt
    dokument ska inte längre klistra in den gamla texten. Upprepa efter utloggning/inloggning.
    Prova även tömning under paus och med redan tom historik. En markerad text
    i PRIMARY ska fortfarande gå att klistra in med mittenknappen i appar som stöder det.
11. Stäng av/på med kommandona nedan och kontrollera att inga extra panelikoner,
    dubbla poster eller fel uppstår. Prova ljust/mörkt tema och en mindre skärm.

```sh
gnome-extensions disable cliplet@local
gnome-extensions enable cliplet@local
```

## Felsökning

- Saknas tillägget? Kontrollera UUID-katalogen, logga ut/in efter första installationen
  och kör `gnome-extensions info cliplet@local`.
- Inställningsfel? Kör `glib-compile-schemas --strict schemas` och kopiera schemat enligt ovan.
- Ingen insamling? Kontrollera pausläget och kopiera ny text med Ctrl+C.
- Lagringsfel? Kontrollera ledigt utrymme och ägare/rättigheter för datakatalogen.
  Vid trasig JSON visas ett läsfel. **Töm historik** skapar då en ny tom historik.
- Shell-fel: `journalctl --user -b /usr/bin/gnome-shell`.
  Inställningsfel: `journalctl --user -b /usr/bin/gjs`.
  Dela inte hela loggar utan att granska dem för annan privat information.
- Ändrad JS-kod kräver normalt utloggning/inloggning för säker omladdning av moduler.
- Inaktivera aldrig GNOMEs versionskontroll för att kringgå ett kompatibilitetsfel.

## Avinstallation

Kör själv när du vill ta bort tillägget:

```sh
gnome-extensions disable cliplet@local
gnome-extensions uninstall cliplet@local
```

Historiken och GSettings lämnas kvar vid avinstallation. För fullständig rensning,
öppna först tilläggets meny och välj **Töm historik**, eller radera just katalogen
`${XDG_DATA_HOME:-$HOME/.local/share}/cliplet` i Filer efter avaktivering.
För att även återställa inställningarna, kör före avinstallationen:

```sh
gsettings --schemadir "${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/cliplet@local/schemas" \
  reset-recursively org.gnome.shell.extensions.cliplet
```

## Implementation och API-underlag

`extension.js` hanterar panel/meny och Mutters `Meta.Selection::owner-changed`,
filtrerat på `SELECTION_CLIPBOARD`. `St.Clipboard.get_mimetypes()` körs före
asynkron `get_text()`. Generationsnummer förkastar gamla svar, även efter radering,
paus eller avaktivering. Insamlingen skriver aldrig tillbaka till urklippet.
Ingen polling används. Signalanslutningar kopplas bort och UI förstörs vid
synkron `disable()`. St:s textläsning saknar avbrytningsparameter; sena callbacks
blir verkningslösa. Pågående filläsning avbryts. Redan beställda skrivningar får
slutföras i ordning utan att behålla Shell-UI, så att radering inte tappas vid disable.

`storage.js` använder asynkron Gio-I/O och en seriell kö även över snabba disable/enable.
`history.js` innehåller historikregler. `prefs.js` använder ExtensionPreferences,
Adwaita och GSettings-bindningar. Ubuntu Dock och andra tillägg modifieras inte.

API kontrollerat mot installerade GNOME Shell/Mutter 51-typbibliotek och Shells
installerade menyimplementation samt officiell dokumentation:

- [GNOME Shell 51-portningsguide](https://gjs.guide/extensions/upgrading/gnome-shell-51.html)
- [GNOME-inställningar och GSettings](https://gjs.guide/extensions/development/preferences.html)
- [St.Clipboard](https://gnome.pages.gitlab.gnome.org/gnome-shell/st/class.Clipboard.html)
- [Mutter Meta](https://mutter.gnome.org/meta/)

Online-API-dokumentationen kan följa nästa GNOME-version; installerade 51-API:er
kontrollerades därför också lokalt. Använd testlistan ovan för att verifiera
funktionerna i din egen Wayland-session.


## Licens

Cliplet distribueras under [MIT-licensen](LICENSE).
Copyright (c) 2026 Markus Högberg.

Licenstext: [Open Source Initiative](https://opensource.org/license/mit).
