// Keep the original text intact; normalize only the on-screen preview.
export function normalizeHistory(items, limit) {
    return [...new Set(items.filter(text =>
        typeof text === 'string' && text.trim().length > 0))].slice(0, limit);
}

export function prepend(items, text, limit) {
    return normalizeHistory([text, ...items], limit);
}

export function preview(text) {
    const line = text.replace(/\s+/gu, ' ').trim();
    return line.length > 160 ? `${line.slice(0, 160)}…` : line;
}

export function isTextClipboard(types) {
    // File managers often offer a plain-text URI alongside their file payload.
    if (!Array.isArray(types) || types.some(type =>
        ['text/uri-list', 'x-special/gnome-copied-files',
            'application/x-kde-cutselection'].includes(type)))
        return false;
    return types.some(type => /^text\/plain(?:;|$)/i.test(type) ||
        ['UTF8_STRING', 'STRING', 'TEXT'].includes(type));
}
