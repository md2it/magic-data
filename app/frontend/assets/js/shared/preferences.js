/** localStorage keys and typed getters/setters for UI preferences. */

export const PREF = {
    defaultView: "magicdata.defaultView",
    booleanIcons: "magicdata.booleanIcons",
    boolSum: "magicdata.showBoolSum",
    numberFormat: "magicdata.numberFormat",
    sidebarCollapsed: "magicdata.sidebarCollapsed",
};

export function readBool(key, defaultValue) {
    try {
        const stored = localStorage.getItem(key);
        if (stored === null) return defaultValue;
        return stored === "true";
    } catch (err) {
        return defaultValue;
    }
}

export function writeBool(key, value) {
    try {
        localStorage.setItem(key, String(value));
    } catch (err) {
        /* storage unavailable — keep session-only choice */
    }
}

export function readString(key, fallback) {
    try {
        const stored = localStorage.getItem(key);
        return stored === null ? fallback : stored;
    } catch (err) {
        return fallback;
    }
}

export function writeString(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (err) {
        /* storage unavailable — keep session-only choice */
    }
}
