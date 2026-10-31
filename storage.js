import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

// Shared across enable/disable cycles: an old write must never overwrite a
// newer deletion. Pending durable writes finish without retaining Shell UI.
let queue = Promise.resolve();
function serial(operation) {
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
}

function call(file, method, finish, args) {
    return new Promise((resolve, reject) => {
        file[method](...args, (source, result) => {
            try {
                resolve(source[finish](result));
            } catch (error) {
                reject(error);
            }
        });
    });
}

async function ensureDirectory(directory) {
    try {
        await call(directory, 'make_directory_async', 'make_directory_finish',
            [GLib.PRIORITY_DEFAULT, null]);
    } catch (error) {
        if (error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) {
            await ensureDirectory(directory.get_parent());
            await ensureDirectory(directory);
        } else if (!error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS)) {
            throw error;
        }
    }
}

export class HistoryStorage {
    constructor(directory = GLib.build_filenamev([GLib.get_user_data_dir(), 'cliplet'])) {
        this._directory = Gio.File.new_for_path(directory);
        this._file = this._directory.get_child('history.json');
    }

    load(cancellable) {
        return serial(async () => {
            try {
                const [, bytes] = await call(this._file,
                    'load_contents_async', 'load_contents_finish', [cancellable]);
                const data = JSON.parse(new TextDecoder().decode(bytes));
                if (!Array.isArray(data) || !data.every(item => typeof item === 'string'))
                    throw new Error('Invalid history format');
                return data;
            } catch (error) {
                if (error.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
                    return [];
                throw error;
            }
        });
    }

    save(items) {
        const bytes = new GLib.Bytes(new TextEncoder().encode(JSON.stringify(items)));
        return serial(async () => {
            await ensureDirectory(this._directory);
            const info = new Gio.FileInfo();
            info.set_attribute_uint32('unix::mode', 0o700);
            await call(this._directory, 'set_attributes_async', 'set_attributes_finish',
                [info, Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, GLib.PRIORITY_DEFAULT, null]);
            // No backup containing deleted entries; atomic replacement, mode 0600.
            await call(this._file, 'replace_contents_bytes_async', 'replace_contents_finish',
                [bytes, null, false,
                    Gio.FileCreateFlags.PRIVATE | Gio.FileCreateFlags.REPLACE_DESTINATION, null]);
        });
    }
}
