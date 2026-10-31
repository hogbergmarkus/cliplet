import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Pango from 'gi://Pango';
import St from 'gi://St';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {isTextClipboard, normalizeHistory, prepend, preview} from './history.js';
import {HistoryStorage} from './storage.js';

export default class Cliplet extends Extension {
    enable() {
        this._watchLegacyVersion();
        const state = {
            active: true, revision: 0, items: [], loaded: false,
            error: null, saveRevision: 0,
            settings: this.getSettings(),
            clipboard: St.Clipboard.get_default(),
            selection: global.display.get_selection(),
            storage: new HistoryStorage(),
            cancellable: new Gio.Cancellable(),
        };
        this._state = state;
        this._indicator = new PanelMenu.Button(0.0, 'Cliplet');
        this._indicator.add_child(new St.Icon({
            icon_name: 'edit-paste-symbolic', style_class: 'system-status-icon',
        }));
        Main.panel.addToStatusArea(this.uuid, this._indicator);
        state.ready = state.storage.load(state.cancellable).then(items => {
            if (state.active)
                state.items = normalizeHistory(items, state.settings.get_int('history-length'));
        }).catch(() => {
            if (state.active)
                state.error = _('Could not read the history.');
        }).then(() => {
            if (!state.active)
                return;
            state.loaded = true;
            this._render(state);
            // Persist trimming and deduplication, but do not overwrite a failed load.
            if (!state.error)
                this._save(state);
        });
        state.ownerId = state.selection.connect('owner-changed', (_selection, type, owner) => {
            if (type !== Meta.SelectionType.SELECTION_CLIPBOARD)
                return;
            const revision = ++state.revision;
            if (owner && !state.settings.get_boolean('paused'))
                this._readClipboard(state, revision);
        });
        state.settingsId = state.settings.connect('changed', (_settings, key) => {
            if (key === 'paused')
                ++state.revision; // Invalidate reads started before pausing, even after resume.
            if (key === 'history-length' && state.loaded) {
                state.items = normalizeHistory(state.items, state.settings.get_int(key));
                this._save(state);
            }
            this._render(state);
        });
        this._render(state);
    }

    _watchLegacyVersion() {
        // Refuse even an inactive legacy installation: it can be enabled later
        // and has no reciprocal conflict guard. Migration requires uninstall + logout.
        const legacyUuid = 'cliplet@local';
        const manager = Main.extensionManager;
        if (manager.lookup(legacyUuid))
            throw new Error(_('Uninstall old Cliplet (cliplet@local) and log out and back in before enabling this version. History and settings will be kept.'));

        this._legacySignalId = manager.connect('extension-state-changed', (_manager, extension) => {
            if (extension.uuid !== legacyUuid)
                return;
            // GNOME 51 emits state changes synchronously, including ACTIVATING
            // before calling enable(). Stop our collector/UI before legacy can start.
            this.disable();
            manager.disableExtension(this.uuid);
            Main.notify(_('Cliplet has been disabled'),
                _('Old Cliplet (cliplet@local) was detected. Uninstall it and log out and back in before enabling the new version.'));
        });
    }

    _readClipboard(state, revision) {
        try {
            const types = state.clipboard.get_mimetypes(St.ClipboardType.CLIPBOARD);
            if (!isTextClipboard(types))
                return;
            state.clipboard.get_text(St.ClipboardType.CLIPBOARD, async (_clipboard, text) => {
                await state.ready;
                if (!state.active || revision !== state.revision ||
                    state.settings.get_boolean('paused') ||
                    typeof text !== 'string' || !text.trim() || state.items[0] === text)
                    return;
                state.items = prepend(state.items, text, state.settings.get_int('history-length'));
                this._save(state);
                this._render(state);
            });
        } catch {
            // The owner can disappear between MIME discovery and requesting text.
            // Do not log exceptions from clipboard providers or clipboard content.
        }
    }

    _save(state) {
        const revision = ++state.saveRevision;
        state.storage.save(state.items).then(() => {
            if (state.active && revision === state.saveRevision && state.error) {
                state.error = null;
                this._render(state);
            }
        }).catch(() => {
            if (state.active && revision === state.saveRevision) {
                state.error = _('Could not save the history. Check your storage.');
                this._render(state);
            }
        });
    }

    _remove(state, text = null) {
        ++state.revision; // A late read must not resurrect a deleted entry.
        state.items = text === null ? [] : state.items.filter(item => item !== text);
        if (text === null) {
            // Only clear CLIPBOARD. The resulting owner-changed read is empty
            // and is ignored by _readClipboard; earlier reads are invalidated above.
            state.clipboard.set_text(St.ClipboardType.CLIPBOARD, '');
        }
        this._save(state);
        this._render(state);
    }

    _render(state) {
        if (!state.active)
            return;
        const menu = this._indicator.menu;
        menu.removeAll();
        if (state.error)
            menu.addMenuItem(new PopupMenu.PopupMenuItem(state.error, {reactive: false}));
        if (state.settings.get_boolean('paused'))
            menu.addMenuItem(new PopupMenu.PopupMenuItem(_('Collection is paused'), {reactive: false}));

        const section = new PopupMenu.PopupMenuSection();
        const scroll = new St.ScrollView({style_class: 'cliplet-history'});
        scroll.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        scroll.set_child(section.box);
        section.actor = scroll;
        scroll._delegate = section;
        menu.addMenuItem(section);
        if (!state.loaded || !state.items.length) {
            section.addMenuItem(new PopupMenu.PopupMenuItem(
                state.loaded ? _('History is empty') : _('Loading history…'), {reactive: false}));
        }
        for (const text of state.items) {
            // Two sibling hit targets: deleting cannot activate the copy action.
            const row = new PopupMenu.PopupBaseMenuItem({activate: false, can_focus: false});
            const label = new St.Label({text: preview(text), y_align: Clutter.ActorAlign.CENTER});
            label.clutter_text.set_single_line_mode(true);
            label.clutter_text.set_ellipsize(Pango.EllipsizeMode.END);
            const copy = new St.Button({
                child: label, x_expand: true, can_focus: true,
                style_class: 'cliplet-text', accessible_name: preview(text),
            });
            copy.connect('clicked', () => {
                ++state.revision;
                state.clipboard.set_text(St.ClipboardType.CLIPBOARD, text);
                menu.close();
                // The owner-changed event handles promotion; reads never write back.
            });
            const remove = new St.Button({
                child: new St.Icon({icon_name: 'window-close-symbolic', icon_size: 14}),
                style_class: 'button cliplet-delete', can_focus: true,
                accessible_name: _('Delete entry'),
            });
            remove.connect('clicked', () => this._remove(state, text));
            row.add_child(copy);
            row.add_child(remove);
            section.addMenuItem(row);
        }
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        menu.addAction(_('Settings'), () => this.openPreferences());
        const clear = menu.addAction(_('Clear history'), () => this._remove(state));
        clear.setSensitive(state.loaded);
    }

    disable() {
        if (this._legacySignalId) {
            Main.extensionManager.disconnect(this._legacySignalId);
            this._legacySignalId = null;
        }
        const state = this._state;
        if (!state)
            return;
        state.active = false;
        ++state.revision;
        state.selection.disconnect(state.ownerId);
        state.settings.disconnect(state.settingsId);
        state.cancellable.cancel();
        this._indicator.destroy();
        this._indicator = null;
        this._state = null;
        // St.get_text has no cancellation API: callbacks are invalidated above.
        // Already queued atomic saves complete; no UI or signals survive disable.
    }
}
