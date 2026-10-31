import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class ClipletPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window.set_default_size(480, 320);
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage({title: 'Cliplet', icon_name: 'edit-paste-symbolic'});
        const group = new Adw.PreferencesGroup({
            title: _('Clipboard history'),
            description: _('History is stored only on this computer. Copied passwords and other sensitive text may also be saved. Pause collection when needed.'),
        });
        const length = new Adw.SpinRow({
            title: _('History length'),
            subtitle: _('Number of saved texts (5–25)'),
            adjustment: new Gtk.Adjustment({lower: 5, upper: 25, step_increment: 1, page_increment: 5}),
        });
        const paused = new Adw.SwitchRow({title: _('Pause collection')});
        settings.bind('history-length', length, 'value', Gio.SettingsBindFlags.DEFAULT);
        settings.bind('paused', paused, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(length);
        group.add(paused);
        page.add(group);
        window.add(page);
        // Bindings are released with their target widgets.
        window._clipletSettings = settings;
    }
}
