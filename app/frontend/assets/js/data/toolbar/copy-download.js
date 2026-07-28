import { currentView, state } from "../app-state.js";
import { showToast } from "../file-tree.js";
import { updateFileHistoryMeta } from "../navigation.js";
import { closeOtherMenus, registerMenuCloser } from "./menus.js";

function baseFileName(path) {
    const name = path.split("/").pop() || "file";
    return name.replace(/\.[^./]+$/, "");
}

function triggerDownload(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function printAsView(viewName) {
    const content = document.getElementById("file-content");
    const originalView = currentView();
    const originalTitle = document.title;

    window.ContentView.render(viewName, state.currentFileText, content);
    updateFileHistoryMeta(viewName, state.currentFileText);
    document.title = baseFileName(state.currentFilePath);

    function restore() {
        window.removeEventListener("afterprint", restore);
        document.title = originalTitle;
        window.ContentView.render(originalView, state.currentFileText, content);
        updateFileHistoryMeta(originalView, state.currentFileText);
    }
    window.addEventListener("afterprint", restore);
    window.print();
}

function downloadAs(format) {
    if (!state.currentFilePath) return;
    const base = baseFileName(state.currentFilePath);
    switch (format) {
        case "json":
            triggerDownload(`${base}.json`, state.currentFileText, "application/json");
            break;
        case "csv":
            triggerDownload(`${base}.csv`, window.ContentView.toDelimited(state.currentFileText, ","), "text/csv");
            break;
        case "tsv":
            triggerDownload(`${base}.tsv`, window.ContentView.toDelimited(state.currentFileText, "\t"), "text/tab-separated-values");
            break;
        case "markdown-table":
            triggerDownload(`${base}.md`, window.ContentView.toMarkdownTable(state.currentFileText, base), "text/markdown");
            break;
        case "pdf-table":
            printAsView("table");
            break;
        case "pdf-text":
            printAsView("text");
            break;
    }
}

export function initDownloadMenu() {
    const button = document.getElementById("download-button");
    const dropdown = document.getElementById("download-dropdown");

    function closeDropdown() {
        dropdown.hidden = true;
        button.setAttribute("aria-expanded", "false");
    }
    registerMenuCloser(closeDropdown);

    button.addEventListener("click", function (event) {
        event.stopPropagation();
        const willOpen = dropdown.hidden;
        if (willOpen) closeOtherMenus(closeDropdown);
        dropdown.hidden = !willOpen;
        button.setAttribute("aria-expanded", String(willOpen));
    });

    dropdown.querySelectorAll("[data-format]").forEach(function (item) {
        item.addEventListener("click", function () {
            closeDropdown();
            downloadAs(item.dataset.format);
        });
    });

    document.addEventListener("click", function (event) {
        if (!dropdown.hidden && !dropdown.contains(event.target) && event.target !== button) {
            closeDropdown();
        }
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && !dropdown.hidden) closeDropdown();
    });
}

async function copyToClipboard(content) {
    if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(content);
        return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = content;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("Clipboard copy failed");
}

function copyAs(format) {
    if (!state.currentFilePath) return Promise.resolve();

    const content = format === "table"
        ? window.ContentView.toDelimited(state.currentFileText, "\t")
        : state.currentFileText;

    return copyToClipboard(content).then(function () {
        showToast("Copied to clipboard");
    }).catch(function () {
        showToast("Could not copy to clipboard");
    });
}

export function initCopyMenu() {
    const button = document.getElementById("copy-button");
    const dropdown = document.getElementById("copy-dropdown");

    function closeDropdown() {
        dropdown.hidden = true;
        button.setAttribute("aria-expanded", "false");
    }
    registerMenuCloser(closeDropdown);

    button.addEventListener("click", function (event) {
        event.stopPropagation();
        const willOpen = dropdown.hidden;
        if (willOpen) closeOtherMenus(closeDropdown);
        dropdown.hidden = !willOpen;
        button.setAttribute("aria-expanded", String(willOpen));
    });

    dropdown.querySelectorAll("[data-copy-format]").forEach(function (item) {
        item.addEventListener("click", function () {
            closeDropdown();
            copyAs(item.dataset.copyFormat);
        });
    });

    document.addEventListener("click", function (event) {
        if (!dropdown.hidden && !dropdown.contains(event.target) && event.target !== button) {
            closeDropdown();
        }
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && !dropdown.hidden) closeDropdown();
    });
}
