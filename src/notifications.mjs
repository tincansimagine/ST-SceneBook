let listening = false;

export function placeNotices() {
    const toast = globalThis.toastr;
    if (!toast?.getContainer) return;
    if (!listening) {
        // Move native toasts before a closing dialog is removed with its children.
        document.addEventListener('close', placeNotices, true);
        listening = true;
    }
    const container = toast.getContainer(undefined, true)?.[0];
    if (!container) return;
    const parent = Array.from(document.querySelectorAll('dialog[open]:not([closing])')).at(-1) ?? document.body;
    if (container.parentElement !== parent) parent.append(container);
}

export function notify(message, { kind = 'info', persistent = false } = {}) {
    const toast = globalThis.toastr;
    if (toast?.[kind]) {
        placeNotices();
        const node = toast[kind](String(message), '씬북', {
            escapeHtml: true, closeButton: true, progressBar: false,
            timeOut: persistent ? 0 : kind === 'error' ? 15000 : 5000,
            extendedTimeOut: persistent ? 0 : 1500, preventDuplicates: false,
        });
        if (node) return {
            close: () => node.remove(),
            update: value => node.find('.toast-message').text(value),
        };
    }
    // SillyTavern provides toastr. Do not substitute a differently styled overlay.
    console.warn('[씬북]', String(message));
    return { close() {}, update: value => console.warn('[씬북]', String(value)) };
}

export function notice(message, error = false) { return notify(message, { kind: error ? 'error' : 'info' }); }
export function progressNotice(message) { return notify(message, { persistent: true }); }
