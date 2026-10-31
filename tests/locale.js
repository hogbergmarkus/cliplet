import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gettext from 'gettext';

const root = GLib.get_current_dir();
const [, bytes] = Gio.File.new_for_path(ARGV[0]).load_contents(null);
const {domain, messages} = JSON.parse(new TextDecoder().decode(bytes));
Gettext.bindtextdomain(domain, GLib.build_filenamev([root, ARGV[2] === 'missing' ? '.test-output/no-such-locale' : 'locale']));
const {gettext: _} = Gettext.domain(domain);
for (const [english, swedish] of messages) {
    const expected = ARGV[1] === 'sv' ? swedish : english;
    if (_(english) !== expected)
        throw new Error(`Unexpected translation: ${english}`);
}
if (_('Missing translation fallback') !== 'Missing translation fallback')
    throw new Error('Missing message did not fall back to English');
print(`OK: ${ARGV[1]}, ${messages.length} real GJS/gettext lookups and missing-message fallback`);


// Run the real preference-building method with lightweight widget doubles.
// Translation is real gettext; no GTK window or installed extension is needed.
const [, prefsBytes] = Gio.File.new_for_path(`${root}/prefs.js`).load_contents(null);
const prefsSource = new TextDecoder().decode(prefsBytes)
    .replace(/^import .*;\n/gm, '').replace('export default class ClipletPreferences', 'return class ClipletPreferences');
const widgets = [];
class Widget {
    constructor(properties) { this.properties = properties; widgets.push(properties); }
    add() {}
}
const Prefs = new Function('Adw', 'Gio', 'Gtk', 'ExtensionPreferences', '_', prefsSource)(
    {PreferencesPage: Widget, PreferencesGroup: Widget, SpinRow: Widget, SwitchRow: Widget},
    {SettingsBindFlags: {DEFAULT: 0}}, {Adjustment: Widget},
    class { getSettings() { return {bind() {}}; } }, _);
new Prefs().fillPreferencesWindow({set_default_size() {}, add() {}});
for (const text of ['Clipboard history', 'History length', 'Pause collection']) {
    if (!widgets.some(widget => widget.title === _(text)))
        throw new Error(`Untranslated preference title: ${text}`);
}
if (!widgets.some(widget => widget.subtitle === _('Number of saved texts (5–25)')))
    throw new Error('Missing translated subtitle');
print('OK: localized preference widget titles and subtitle');
