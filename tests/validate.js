import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gettext from 'gettext';
import {normalizeHistory, prepend, preview, isTextClipboard} from '../history.js';
import {HistoryStorage} from '../storage.js';

function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}
const root = Gio.File.new_for_path(GLib.get_current_dir());
for (const name of ['extension.js', 'prefs.js', 'history.js', 'storage.js', 'tests/validate.js']) {
    const [, data] = root.get_child(name).load_contents(null);
    Reflect.parse(new TextDecoder().decode(data), {target: 'module'});
}
const [, metadataBytes] = root.get_child('metadata.json').load_contents(null);
const metadata = JSON.parse(new TextDecoder().decode(metadataBytes));
assert(metadata.uuid === 'cliplet@hogbergmarkus.github.io' && metadata['shell-version'].join() === '51', 'Metadata');
assert(metadata['gettext-domain'] === metadata.uuid, 'Gettext domain');
Gettext.bindtextdomain(metadata['gettext-domain'], root.get_child('locale').get_path());
const _ = Gettext.domain(metadata['gettext-domain']).gettext;
assert(metadata.url === 'https://github.com/hogbergmarkus/cliplet', 'Project URL');
assert(metadata['settings-schema'] === 'org.gnome.shell.extensions.cliplet', 'Existing settings schema retained');
assert(JSON.stringify(prepend(['a', 'b', 'c'], 'b', 2)) === '["b","a"]', 'Deduplication/order/limit');
assert(normalizeHistory(['', '  ', null, ' a\n', ' a\n'], 15)[0] === ' a\n', 'Keep original');
assert(preview('a\nb') === 'a b' && preview('x'.repeat(300)).length === 161, 'Preview');
assert(isTextClipboard(['text/plain;charset=utf-8']), 'Text MIME');
assert(!isTextClipboard(['text/plain', 'text/uri-list']), 'File MIME');
assert(!isTextClipboard(['image/png']) && !isTextClipboard(null), 'Nontext/null MIME');
const schemaSource = Gio.SettingsSchemaSource.new_from_directory(
    root.get_child('schemas').get_path(), Gio.SettingsSchemaSource.get_default(), false);
const schema = schemaSource.lookup(metadata['settings-schema'], false);
assert(schema.get_path() === '/org/gnome/shell/extensions/cliplet/', 'Existing settings path retained');
assert(schema.get_key('history-length').get_default_value().get_int32() === 15, 'Default length');
for (const value of [5, 15, 25])
    assert(schema.get_key('history-length').range_check(new GLib.Variant('i', value)), 'Valid range');
for (const value of [4, 26])
    assert(!schema.get_key('history-length').range_check(new GLib.Variant('i', value)), 'Invalid range');

const directory = root.get_child('.test-output');
try { directory.make_directory(null); } catch (e) {
    if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS)) throw e;
}
const testPath = `${directory.get_path()}/storage-${GLib.uuid_string_random()}`;
Gio.File.new_for_path(testPath).make_directory(null);
assert(new HistoryStorage()._file.get_path() ===
    GLib.build_filenamev([GLib.get_user_data_dir(), 'cliplet', 'history.json']),
'Existing history location retained');
const store = new HistoryStorage(`${testPath}/private`);
assert((await store.load(null)).length === 0, 'Missing history');
await store.save(['ett', 'två\nmed radbrytning']);
assert((await store.load(null))[1] === 'två\nmed radbrytning', 'Unicode roundtrip');
const first = store.save(['raderas']);
const second = store.save([]);
const reopened = new HistoryStorage(`${testPath}/private`);
assert((await reopened.load(null)).length === 0, 'Queued clear persists across instances');
await Promise.all([first, second]);
for (const [path, mode] of [[`${testPath}/private`, 0o700], [`${testPath}/private/history.json`, 0o600]]) {
    const info = Gio.File.new_for_path(path).query_info('unix::mode', Gio.FileQueryInfoFlags.NONE, null);
    assert((info.get_attribute_uint32('unix::mode') & 0o777) === mode, 'Private permissions');
}
const file = Gio.File.new_for_path(`${testPath}/private/history.json`);
file.replace_contents('invalid JSON', null, false, Gio.FileCreateFlags.PRIVATE, null);
let rejected = false;
try { await store.load(null); } catch { rejected = true; }
assert(rejected, 'Corruption detected');
await store.save([]);
assert((await store.load(null)).length === 0, 'Explicit clear repairs storage');
print('OK: JS syntax, metadata, settings, history, MIME, async persistence, deletion, permissions, corruption.');

// Exercise the real controller methods with delayed clipboard callbacks.
// Shell widgets are unavailable outside the compositor; only the I/O boundary is mocked.
const [, sourceBytes] = root.get_child('extension.js').load_contents(null);
const controllerSource = new TextDecoder().decode(sourceBytes)
    .replace(/^import .*;\n/gm, '').replace('export default class Cliplet', 'return class Cliplet');
const mockMain = {};
const Controller = new Function('Extension', 'St', 'isTextClipboard', 'prepend', 'Main', '_', controllerSource)(
    class {}, {ClipboardType: {CLIPBOARD: 1}}, isTextClipboard, prepend, mockMain, _);
const controller = new Controller();
let saves = 0;
controller._save = () => saves++;
controller._render = () => {};
let paused = false;
const callbacks = [];
const clipboardWrites = [];
const state = {
    active: true, revision: 1, items: [], ready: Promise.resolve(),
    settings: {get_boolean: () => paused, get_int: () => 15},
    clipboard: {
        get_mimetypes: () => ['text/plain'],
        get_text: (_type, callback) => callbacks.push(callback),
        set_text: (type, text) => clipboardWrites.push([type, text]),
    },
};
controller._readClipboard(state, 1);
state.revision = 2;
controller._readClipboard(state, 2);
await callbacks[1](null, 'ny');
await callbacks[0](null, 'gammal');
assert(state.items.join() === 'ny', 'Out-of-order reads');
controller._readClipboard(state, 2);
controller._remove(state);
await callbacks[2](null, 'ska inte återställas');
assert(state.items.length === 0, 'Deletion invalidates pending reads');
controller._readClipboard(state, 3);
paused = true;
await callbacks[3](null, 'pausad');
assert(state.items.length === 0, 'Pause during read');
paused = false;
controller._readClipboard(state, 3);
state.active = false;
await callbacks[4](null, 'avstängd');
assert(state.items.length === 0, 'Disable during read');
state.active = true;
state.items = ['samma'];
controller._readClipboard(state, 3);
const previousSaves = saves;
await callbacks[5](null, 'samma');
assert(saves === previousSaves, 'Self-copy causes no duplicate writes');
print('OK: out-of-order callbacks, deletion race, pause, disable, duplicate feedback.');

assert(JSON.stringify(clipboardWrites) === '[[1,""]]', 'Clear targets only CLIPBOARD with empty text');
controller._remove(state, 'samma');
assert(clipboardWrites.length === 1, 'Deleting one entry leaves clipboard unchanged');

// Use real queued storage and simulate owner-changed during set_text, including
// an older nonempty read arriving after the empty clipboard read.
const clearController = new Controller();
clearController._render = () => {};
let systemClipboard = 'gammal text';
const pendingReads = [];
const clearState = {
    active: true, revision: 0, saveRevision: 0, items: ['gammal text'],
    ready: Promise.resolve(), storage: store, error: null,
    settings: {get_boolean: () => paused, get_int: () => 15},
    clipboard: {
        get_mimetypes: () => ['text/plain'],
        get_text: (type, callback) => {
            assert(type === 1, 'Read only CLIPBOARD');
            const snapshot = systemClipboard;
            pendingReads.push(() => callback(null, snapshot));
        },
        set_text: (type, text) => {
            assert(type === 1 && text === '', 'Clear only CLIPBOARD');
            systemClipboard = text;
            const revision = ++clearState.revision;
            if (!paused)
                clearController._readClipboard(clearState, revision);
        },
    },
};
clearController._save(clearState); // An old save is still queued when clearing.
clearController._readClipboard(clearState, clearState.revision);
clearController._remove(clearState);
assert(systemClipboard === '', 'System clipboard cleared immediately');
assert(clearState.items.length === 0, 'History cleared immediately');
await pendingReads[1](); // Empty read caused by clear.
await pendingReads[0](); // Late nonempty read from before clear.
assert(clearState.items.length === 0 && clearState.saveRevision === 2,
    'Clear event adds no empty entry; old read cannot restore history');
assert((await store.load(null)).length === 0, 'Clear persists after older queued save');

paused = true;
systemClipboard = 'kopierad under paus';
clearController._remove(clearState);
assert(systemClipboard === '' && clearState.items.length === 0,
    'Clear also empties clipboard while paused and history already empty');
assert((await store.load(null)).length === 0, 'Paused clear persists');
paused = false;
systemClipboard = 'ny kopiering efter tömning';
clearController._readClipboard(clearState, ++clearState.revision);
await pendingReads[2]();
assert(clearState.items[0] === systemClipboard, 'New copies still collected after clear');
assert((await store.load(null))[0] === systemClipboard, 'New copies still persist');
print('OK: CLIPBOARD clear, PRIMARY untouched, individual deletion, clear event race, paused clear, subsequent copy.');


// Legacy UUID is intentionally retained only for migration/conflict detection.
const legacyUuid = 'cliplet@local';
let legacy = null;
let handler = null;
let disconnected = 0;
let notifications = 0;
const disabledUuids = [];
mockMain.extensionManager = {
    lookup: uuid => uuid === legacyUuid ? legacy : null,
    connect: (signal, callback) => {
        assert(signal === 'extension-state-changed', 'GNOME manager signal');
        assert(handler === null, 'No duplicate signal subscription');
        handler = callback;
        return 42;
    },
    disconnect: id => {
        assert(id === 42, 'Disconnect matching manager signal');
        handler = null;
        disconnected++;
    },
    disableExtension: uuid => disabledUuids.push(uuid),
};
mockMain.notify = () => notifications++;
for (const legacyState of [1, 2, 3, 6, 7, 8]) {
    legacy = {uuid: legacyUuid, state: legacyState};
    const guarded = new Controller();
    guarded.getSettings = () => { throw new Error('Unexpected resource creation'); };
    let refused = false;
    try { guarded.enable(); } catch (error) {
        refused = error.message === _('Uninstall old Cliplet (cliplet@local) and log out and back in before enabling this version. History and settings will be kept.');
    }
    assert(refused && !guarded._state && handler === null,
        'Existing legacy installation blocks enable before creating resources');
    guarded.disable(); // GNOME may clean up a failed enable.
}
legacy = null;
for (const laterState of [6, 8, 1]) {
    const guarded = new Controller();
    guarded.uuid = metadata.uuid;
    guarded._watchLegacyVersion();
    let cleaned = 0;
    const activeState = {
        active: true, revision: 0, ownerId: 10, settingsId: 11,
        selection: {disconnect: id => { assert(id === 10, 'Clipboard signal'); cleaned++; }},
        settings: {disconnect: id => { assert(id === 11, 'Settings signal'); cleaned++; }},
        cancellable: {cancel: () => cleaned++},
    };
    guarded._state = activeState;
    guarded._indicator = {destroy: () => cleaned++};
    handler(null, {uuid: 'unrelated@example.org', state: laterState});
    assert(activeState.active && cleaned === 0, 'Other extensions unaffected');
    handler(null, {uuid: legacyUuid, state: laterState});
    assert(!activeState.active && activeState.revision === 1 && cleaned === 4,
        'Late legacy detection synchronously stops UI and collection');
    assert(handler === null && guarded._state === null && guarded._indicator === null,
        'Conflict releases resources and manager signal');
    assert(disabledUuids.at(-1) === metadata.uuid, 'Only new Cliplet disables itself');
    guarded.disable();
}
assert(notifications === 3 && disconnected === 3, 'One notification and cleanup per conflict');
const guarded = new Controller();
guarded._watchLegacyVersion();
guarded.disable();
assert(handler === null && disconnected === 4, 'Normal disable also disconnects conflict guard');
assert(disabledUuids.every(uuid => uuid === metadata.uuid), 'Legacy and other extensions never modified');
print('OK: migration metadata/schema, legacy-first/new-first conflicts, signal cleanup, other extensions untouched.');
