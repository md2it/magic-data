import { PREF, readBool } from "../../shared/preferences.js";

export function isCollapsible(value) {
    return value !== null && (Array.isArray(value) || typeof value === "object");
}

export function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Root has an `items` array (project data contract). */
export function hasItemsContract(parsedJson) {
    return isPlainObject(parsedJson) && Array.isArray(parsedJson.items);
}

/** Top-level `schema` — muted / collapsed by default. */
export function isSchemaPath(path) {
    return path.length === 1 && path[0] === "schema";
}

/** Top-level `metadata` — filtered; only description is surfaced. */
export function isMetadataPath(path) {
    return path.length === 1 && path[0] === "metadata";
}

/** `metadata.versions` — collapsed by default in JSON view. */
export function isVersionsPath(path) {
    return path.length === 2 && path[0] === "metadata" && path[1] === "versions";
}

export function isBoolSumEnabled() {
    return readBool(PREF.boolSum, true);
}

/** Boolean icons when preference is on; else String(value). */
export function formatReadableValue(value) {
    if (typeof value === "boolean") {
        return readBool(PREF.booleanIcons, true) ? (value ? "✅" : "❌") : String(value);
    }
    return value === null ? "null" : String(value);
}

/** Trimmed metadata.description, or null. */
export function getMetadataDescription(parsedJson) {
    if (!isPlainObject(parsedJson)) return null;
    const metadata = parsedJson.metadata;
    if (!isPlainObject(metadata)) return null;
    if (typeof metadata.description !== "string") return null;
    return metadata.description.trim() === "" ? null : metadata.description;
}

/** Document display name without .json, or null. */
export function getDocumentDisplayName() {
    try {
        const ctx = window.MagicData &&
            typeof window.MagicData.currentContext === "function"
            ? window.MagicData.currentContext()
            : null;
        const name = ctx && ctx.document && ctx.document.name;
        if (typeof name === "string" && name.trim() !== "") {
            return name.replace(/\.json$/i, "");
        }
    } catch (err) {
    }
    return null;
}

export function summarizeCollapsed(value) {
    if (Array.isArray(value)) {
        return `[...] ${value.length} item${value.length === 1 ? "" : "s"}`;
    }
    const keys = Object.keys(value);
    return `{...} ${keys.length} key${keys.length === 1 ? "" : "s"}`;
}

export function parseJsonSafe(rawText) {
    try {
        return JSON.parse(rawText);
    } catch (err) {
        return undefined;
    }
}
