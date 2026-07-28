import { summarizeDocumentHistory } from "./document-history.js";
import {
    getDocumentDisplayName,
    getMetadataDescription,
    parseJsonSafe,
} from "./helpers.js";
import {
    collectColumns,
    formatExportCellValue,
    selectRowSource,
    toRowObject,
} from "./table-view.js";

function needsQuoting(value, delimiter) {
    return value.indexOf(delimiter) !== -1 || value.indexOf('"') !== -1 ||
        value.indexOf("\n") !== -1 || value.indexOf("\r") !== -1;
}

function delimitedEscape(value, delimiter) {
    return needsQuoting(value, delimiter) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toDelimited(rawText, delimiter) {
    const parsedJson = parseJsonSafe(rawText);
    if (parsedJson === undefined) return rawText;

    const topLevelNodes = selectRowSource(parsedJson);
    if (topLevelNodes === null) return delimitedEscape(formatExportCellValue(parsedJson), delimiter);
    if (topLevelNodes.length === 0) return "";

    const rowObjects = topLevelNodes.map(toRowObject);
    const columns = collectColumns(rowObjects);

    const lines = [columns.map(function (col) { return delimitedEscape(col, delimiter); }).join(delimiter)];
    rowObjects.forEach(function (rowObj) {
        lines.push(columns.map(function (col) {
            return delimitedEscape(formatExportCellValue(rowObj[col]), delimiter);
        }).join(delimiter));
    });
    return lines.join("\r\n");
}

function markdownEscapeCell(value) {
    return String(value)
        .replace(/\r\n|\r|\n/g, " ")
        .replace(/\|/g, "\\|");
}

function finishMarkdownTable(lines) {
    lines.push(
        "",
        "---",
        "",
        "Generated with [Magic Data](https://github.com/md2it/magic-data)"
    );
    return lines.join("\n");
}

export function toMarkdownTable(rawText, titleFallback) {
    const parsedJson = parseJsonSafe(rawText);
    const title = getDocumentDisplayName() || titleFallback || "Document";

    let created = "";
    let updated = "";
    let version = "";
    let description = "";
    if (parsedJson !== undefined) {
        const summary = summarizeDocumentHistory(parsedJson);
        if (summary) {
            created = summary.created;
            updated = summary.updated;
            version = String(summary.version);
        }
        const desc = getMetadataDescription(parsedJson);
        if (desc !== null) description = desc;
    }

    const lines = [
        "# " + title,
        "",
        "## Meta",
        "",
        "- Created: " + created,
        "- Updated: " + updated,
        "- Version: " + version,
        "",
        "Description:",
        description,
        "",
        "## Table",
        "",
    ];

    if (parsedJson === undefined) {
        lines.push(rawText);
        return finishMarkdownTable(lines);
    }

    const topLevelNodes = selectRowSource(parsedJson);
    if (topLevelNodes === null) {
        lines.push("| value |");
        lines.push("| --- |");
        lines.push("| " + markdownEscapeCell(formatExportCellValue(parsedJson)) + " |");
        return finishMarkdownTable(lines);
    }
    if (topLevelNodes.length === 0) {
        return finishMarkdownTable(lines);
    }

    const rowObjects = topLevelNodes.map(toRowObject);
    const columns = collectColumns(rowObjects);
    lines.push("| " + columns.map(markdownEscapeCell).join(" | ") + " |");
    lines.push("| " + columns.map(function () { return "---"; }).join(" | ") + " |");
    rowObjects.forEach(function (rowObj) {
        lines.push("| " + columns.map(function (col) {
            return markdownEscapeCell(formatExportCellValue(rowObj[col]));
        }).join(" | ") + " |");
    });
    return finishMarkdownTable(lines);
}
