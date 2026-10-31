# Cliplet

Minimalistisk urklippshistorik för **GNOME Shell 51 på Wayland**, UUID `cliplet@hogbergmarkus.github.io`.
JavaScript med ES-moduler, GNOMEs egna komponenter och inga externa runtime-beroenden.
Engelska är grundspråk och fallback. En fullständig svensk översättning väljs
automatiskt när systemets locale är svenska. Ingen språkväljare behövs.
Knappnamnen i denna README anges på svenska.

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
För språkbygget och språktesterna behövs även Python 3 och Babel (på Ubuntu
tillhandahålls Babel av paketet `python3-babel`). Dessa är enbart byggberoenden.

```sh
python3 scripts/translations.py build
glib-compile-schemas --strict schemas
gjs -m tests/validate.js
python3 tests/translations.py
```

Testerna kontrollerar JS-modulsyntax med GJS, metadata, GSettings-intervall och standard,
dubbletter, originaltext, MIME-filter, lagring, rättigheter, radering, korrupt JSON och
försenade urklippssvar vid radering, paus och disable. Tömning testas även med
CLIPBOARD-händelser, äldre köade skrivningar, paus och efterföljande kopiering.
Migreringstester kontrollerar oförändrad dataplats och schema, konflikt med gamla
UUID:t i båda startordningarna och att signaler och resurser frigörs.
Testdata skrivs endast i
projektets ignorerade `.test-output/`. GNOME Shell-UI behöver dessutom testas i en
riktig session efter installation. Testerna läser inte ditt urklipp.

## Språk och översättningar

GNOME initierar gettext genom `gettext-domain` i metadata. Shell och
inställningsdialogen använder varsin officiell `gettext`-import och systemets locale.
Engelska visas när en svensk översättning inte väljs eller katalogen saknas.
Efter ändrat systemspråk behöver du logga ut och in; öppna sedan inställningarna igen.
Urklippstexterna översätts aldrig.

Källfilerna finns i `po/cliplet@hogbergmarkus.github.io.pot` och `po/sv.po`.
Byggverktyget använder Babel för standardformaten gettext POT, PO och MO:

```sh
# Efter ändrade originalsträngar: uppdatera mallen och redigera sedan po/sv.po.
python3 scripts/translations.py pot
# Kontrollera att alla meddelanden är översatta och kompilera språkfilerna.
python3 scripts/translations.py build
```

Bygget avvisar saknade, tomma eller fuzzy-markerade översättningar. MO-filerna hamnar i
`locale/sv/LC_MESSAGES/cliplet@hogbergmarkus.github.io.mo` och är ignorerade i Git.
Vid installation måste `locale/` följa med enligt kommandona nedan. Vid framtida
paketering för GNOME Extensions kan GNOMEs `gnome-extensions pack --podir=po` användas
(med GNU gettexts `msgfmt` tillgängligt) för att kompilera och inkludera språkfilerna.
Ingen paketering eller installation sker när bygg- eller testkommandona körs.

Python och Babel behövs endast för att bygga från källkod. Ett färdigbyggt tillägg
med kompilerade MO-filer kräver varken Python eller Babel för installation eller
användning. GNOME läser MO-filerna direkt med sitt inbyggda gettext-stöd;
`scripts/`, `tests/` och PO/POT-källfiler behöver inte installeras.

Metadata och GSettings-schemats beskrivningstexter har engelska original och ingår
i översättningskatalogen. Hur externa verktyg visar dessa beskrivningar beror på deras
gettexthantering; Cliplets egen meny och inställningsdialog använder översättningarna direkt.

Språktesterna använder riktiga GJS/gettext-uppslag i separata processer: C-locale
(engelsk fallback), svenska och ett språk utan översättning. Svensk locale måste finnas
på testdatorn, exempelvis `sv_SE.UTF-8` (kontrollera med `locale -a`).

## Migrering från `cliplet@local`

Den nya versionen använder UUID `cliplet@hogbergmarkus.github.io`. Datakatalogen
`${XDG_DATA_HOME:-$HOME/.local/share}/cliplet` och GSettings-schemat
`org.gnome.shell.extensions.cliplet` med sökvägen `/org/gnome/shell/extensions/cliplet/`
är oförändrade. Ingen export, flytt eller återställning av historik eller inställningar behövs.

1. Pausa insamlingen i gamla Cliplets inställningar och låt pågående sparningar slutföras.
   Kontrollera att inget lagringsfel visas. Använd **inte Töm historik** under migreringen.
2. Avaktivera och avinstallera endast det gamla tillägget:

   ```sh
   gnome-extensions disable cliplet@local
   gnome-extensions uninstall cliplet@local
   ```

3. Logga ut och in. Detta tar bort den gamla versionens inlästa moduler och låter
   färdiga sparningar läsas av den nya versionen i en ny Shell-session.
4. Installera den nya versionen enligt avsnittet nedan och logga ut och in igen.
5. Aktivera det nya UUID:t. Kontrollera att historik, historiklängd och pausläge
   finns kvar, att bara en ikon visas, och återuppta därefter insamlingen.

Radera inte datakatalogen och kör inte `gsettings reset-recursively` vid migrering.
Det gamla tilläggets avinstallation raderar inte dessa data. Om du behöver återgå,
avaktivera och avinstallera den nya versionen, logga ut och in, och installera sedan
den gamla versionen från `v1.0.0`. Båda använder samma data och inställningar.

Den nya versionen vägrar starta om GNOME fortfarande känner till `cliplet@local`,
även om den är avaktiverad. Om den gamla versionen installeras igen under sessionen
stänger den nya av sin insamling och panelikon och avaktiverar sig själv innan den gamla
versionens `enable()` körs. En lokaliserad avisering förklarar konflikten. Inga andra tillägg ändras.
Efter att konflikten har åtgärdats måste den nya versionen aktiveras igen manuellt.

## Installation

Kör från projektkatalogen i en terminal. Kommandona installerar enbart runtime-filer
för din användare och fungerar även när `XDG_DATA_HOME` är anpassad. Ingen sudo behövs.
Installationen ersätter en eventuell tidigare Cliplet-version men behåller dess historik.

```sh
(
  set -eu
  python3 scripts/translations.py build
  glib-compile-schemas --strict schemas
  cliplet_dest="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/cliplet@hogbergmarkus.github.io"
  install -d "$cliplet_dest/schemas"
  install -m 644 metadata.json extension.js history.js storage.js prefs.js stylesheet.css LICENSE \
    "$cliplet_dest/"
  install -m 644 schemas/org.gnome.shell.extensions.cliplet.gschema.xml schemas/gschemas.compiled \
    "$cliplet_dest/schemas/"
  for cliplet_locale in locale/*; do
    cliplet_lang="${cliplet_locale##*/}"
    install -d "$cliplet_dest/locale/$cliplet_lang/LC_MESSAGES"
    install -m 644 "$cliplet_locale/LC_MESSAGES/cliplet@hogbergmarkus.github.io.mo" \
      "$cliplet_dest/locale/$cliplet_lang/LC_MESSAGES/"
  done
)
```

Logga därefter **ut och in igen** så att Shell upptäcker det nya tillägget. Under
Wayland kan Shell inte startas om med Alt+F2 → r. Aktivera sedan:

```sh
gnome-extensions enable cliplet@hogbergmarkus.github.io
gnome-extensions info cliplet@hogbergmarkus.github.io
gnome-extensions prefs cliplet@hogbergmarkus.github.io
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
gnome-extensions disable cliplet@hogbergmarkus.github.io
gnome-extensions enable cliplet@hogbergmarkus.github.io
```

## Felsökning

- Saknas tillägget? Kontrollera UUID-katalogen, logga ut/in efter första installationen
  och kör `gnome-extensions info cliplet@hogbergmarkus.github.io`.
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
gnome-extensions disable cliplet@hogbergmarkus.github.io
gnome-extensions uninstall cliplet@hogbergmarkus.github.io
```

Historiken och GSettings lämnas kvar vid avinstallation. För fullständig rensning,
öppna först tilläggets meny och välj **Töm historik**, eller radera just katalogen
`${XDG_DATA_HOME:-$HOME/.local/share}/cliplet` i Filer efter avaktivering.
För att även återställa inställningarna, kör före avinstallationen:

```sh
gsettings --schemadir "${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/cliplet@hogbergmarkus.github.io/schemas" \
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
- [GNOME gettext och översättningar](https://gjs.guide/extensions/development/translations.html)
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
