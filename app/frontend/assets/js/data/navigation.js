import {
    currentView,
    defaultView,
    loadFileContent,
    loadFileTree,
    state,
    VALID_VIEWS,
} from "./app-state.js";
import {
    displayName,
    expandAncestors,
    expandDirAndAncestors,
    findButton,
    renderTree,
} from "./file-tree.js";
import { updateToolbarActions } from "./toolbar/collapse-group.js";

export function setActiveView(view) {
    const switchEl = document.getElementById("view-switch");
    switchEl.querySelectorAll(".view-switch__option").forEach(function (btn) {
        const active = btn.dataset.view === view;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-checked", String(active));
    });
    updateToolbarActions();
}

function buildDocUrl(path) {
    const parts = path.split("/");
    parts[parts.length - 1] = displayName(parts[parts.length - 1]);
    const view = currentView();
    const qs = `?view=${encodeURIComponent(view)}`;
    return `/data/${parts.map(encodeURIComponent).join("/")}${qs}`;
}

function buildDirUrl(path) {
    if (!path) return "/data";
    return `/data/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export function updateUrl(push) {
    const url = state.currentMode === "dir"
        ? buildDirUrl(state.currentDirPath)
        : buildDocUrl(state.currentFilePath);
    if (push) {
        window.history.pushState(null, "", url);
    } else {
        window.history.replaceState(null, "", url);
    }
}

function findDirNode(nodes, path) {
    if (path === "") return { path: "", children: nodes };
    for (const node of nodes) {
        if (node.type !== "dir") continue;
        if (node.path === path) return node;
        const found = findDirNode(node.children, path);
        if (found) return found;
    }
    return null;
}

export function renderCurrentFile() {
    const content = document.getElementById("file-content");
    const view = currentView();
    window.ContentView.render(view, state.currentFileText, content);
    updateFileHistoryMeta(view, state.currentFileText);
}

export function hideFileHistoryMeta() {
    const el = document.getElementById("file-history-meta");
    if (!el) return;
    el.hidden = true;
    el.textContent = "";
}

export function updateFileHistoryMeta(viewName, rawText) {
    const el = document.getElementById("file-history-meta");
    if (!el) return;
    if (viewName === "json" || state.currentMode !== "doc") {
        hideFileHistoryMeta();
        return;
    }
    let parsed;
    try {
        parsed = JSON.parse(rawText);
    } catch (err) {
        hideFileHistoryMeta();
        return;
    }
    const summary = window.ContentView.summarizeDocumentHistory(parsed);
    if (!summary) {
        hideFileHistoryMeta();
        return;
    }
    el.textContent =
        "Created: " + summary.created +
        " · Updated: " + summary.updated +
        " · Version: " + summary.version;
    el.hidden = false;
}

function showDocChrome() {
    document.getElementById("view-switch").hidden = false;
    document.getElementById("content-toolbar-actions").hidden = false;
}

export async function selectFile(path, button, options) {
    const opts = options || {};
    state.currentMode = "doc";
    showDocChrome();
    document.querySelectorAll(".tree-node__label").forEach(function (btn) {
        btn.classList.toggle("active", btn === button);
    });

    state.currentFilePath = path;
    state.currentFileText = await loadFileContent(path);
    renderCurrentFile();
    if (!opts.silent) updateUrl(Boolean(opts.push));
}

function renderDirectoryListing(path) {
    state.currentMode = "dir";
    state.currentDirPath = path;

    document.querySelectorAll(".tree-node__label").forEach(function (btn) {
        btn.classList.remove("active");
    });
    document.getElementById("view-switch").hidden = true;
    document.getElementById("content-toolbar-actions").hidden = true;
    hideFileHistoryMeta();

    const node = findDirNode(state.currentTree, path);
    const children = node ? node.children : [];

    const content = document.getElementById("file-content");
    content.className = "file-content directory-listing";
    delete content.dataset.currentView;
    content.innerHTML = "";

    const heading = document.createElement("div");
    heading.className = "directory-listing__path";
    heading.textContent = path ? `/${path}` : "/";
    content.appendChild(heading);

    const list = document.createElement("ul");
    list.className = "directory-listing__list";

    if (children.length === 0) {
        const empty = document.createElement("li");
        empty.className = "directory-listing__empty";
        empty.textContent = "(empty)";
        list.appendChild(empty);
    }

    children.forEach(function (child) {
        const li = document.createElement("li");
        li.className = "directory-listing__item";
        const link = document.createElement("button");
        link.type = "button";
        link.className = "directory-listing__link";
        if (child.type === "dir") {
            window.AppIcons.setLabel(link, "folder", child.name);
        } else {
            window.AppIcons.setLabel(link, "file", displayName(child.name));
        }
        link.addEventListener("click", function () {
            if (child.type === "dir") {
                navigateToDir(child.path);
            } else {
                navigateToDoc(child.path);
            }
        });
        li.appendChild(link);
        list.appendChild(li);
    });

    content.appendChild(list);
}

export function navigateToDir(path) {
    const dirLi = path
        ? state.fileTreeRoot.querySelector(`.tree-node--dir[data-path="${CSS.escape(path)}"]`)
        : null;
    if (dirLi) expandDirAndAncestors(dirLi);
    renderDirectoryListing(path);
    updateUrl(true);
}

export function navigateToDoc(path) {
    const button = findButton(path);
    if (!button) return;
    expandAncestors(button);
    selectFile(path, button, { push: true });
}

export async function refreshTree() {
    state.currentTree = await loadFileTree();
    state.fileTreeRoot.innerHTML = "";
    renderTree(state.fileTreeRoot, state.currentTree);

    if (state.currentMode === "doc" && state.currentFilePath) {
        const button = findButton(state.currentFilePath);
        if (button) {
            expandAncestors(button);
            button.classList.add("active");
            updateUrl(false);
        }
    } else if (state.currentMode === "dir") {
        renderDirectoryListing(state.currentDirPath);
    }
}

export async function selectNewEntry(result) {
    await refreshTree();
    if (!result || !result.path) return;

    if (result.type === "dir") {
        navigateToDir(result.path);
        return;
    }

    navigateToDoc(result.path);
}

export function applyInitialState() {
    const initial = window.__INITIAL_STATE__ || { kind: "dir", path: "" };
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    setActiveView(VALID_VIEWS.includes(view) ? view : defaultView());

    if (initial.kind === "dir") {
        if (initial.path) {
            const dirLi = state.fileTreeRoot.querySelector(
                `.tree-node--dir[data-path="${CSS.escape(initial.path)}"]`
            );
            if (dirLi) expandDirAndAncestors(dirLi);
        }
        renderDirectoryListing(initial.path);
        return;
    }

    const button = findButton(initial.path);
    if (button) {
        expandAncestors(button);
        selectFile(initial.path, button, { silent: true });
        updateUrl(false);
    }
}

export function createStructuredFile(button, directoryPath) {
    const targetDirectory = directoryPath ? `data/${directoryPath}/` : "data/";
    return window.magicLlm.runScenario("create-structured-file", {
        button: button,
        context: { targetDirectory: targetDirectory },
        selectedDirectory: targetDirectory,
    });
}
