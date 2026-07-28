/** Mutually exclusive toolbar menus. */
const closers = [];

export function registerMenuCloser(close) {
    closers.push(close);
}

export function closeOtherMenus(keep) {
    closers.forEach(function (close) {
        if (close !== keep) close();
    });
}
