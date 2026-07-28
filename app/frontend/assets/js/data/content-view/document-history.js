import { isPlainObject } from "./helpers.js";

/** Local YYYY-MM-DD HH:MM, or null if invalid. */
export function formatHistoryInstant(iso) {
    if (typeof iso !== "string" || iso.trim() === "") return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    const pad = function (n) { return String(n).padStart(2, "0"); };
    return (
        date.getFullYear() + "-" +
        pad(date.getMonth() + 1) + "-" +
        pad(date.getDate()) + " " +
        pad(date.getHours()) + ":" +
        pad(date.getMinutes())
    );
}

/** Created/Updated/Version from versions key order (first=newest). */
export function summarizeDocumentHistory(parsedJson) {
    try {
        if (!isPlainObject(parsedJson)) return null;
        const metadata = parsedJson.metadata;
        if (!isPlainObject(metadata)) return null;
        const versions = metadata.versions;
        if (!isPlainObject(versions)) return null;
        const keys = Object.keys(versions);
        if (keys.length === 0) return null;
        const newestKey = keys[0];
        const oldestKey = keys[keys.length - 1];
        const versionMatch = /^v([1-9]\d*)$/.exec(newestKey);
        if (!versionMatch) return null;
        const newest = versions[newestKey];
        const oldest = versions[oldestKey];
        if (!isPlainObject(newest) || !isPlainObject(oldest)) return null;
        const created = formatHistoryInstant(oldest.at);
        const updated = formatHistoryInstant(newest.at);
        if (created === null || updated === null) return null;
        return {
            created: created,
            updated: updated,
            version: Number(versionMatch[1]),
        };
    } catch (err) {
        return null;
    }
}
