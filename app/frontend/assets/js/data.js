async function loadFileTree() {
    const response = await fetch("/api/data-tree");
    return response.json();
}

async function loadFileContent(path) {
    const response = await fetch(dataFileUrl(path));
    return response.text();
}

function dataFileUrl(path) {
    return `/api/data-files/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function createDirNode(node) {
    const li = document.createElement("li");
    li.className = "tree-node tree-node--dir";
    li.dataset.name = node.name;
    li.dataset.path = node.path;

    const childList = document.createElement("ul");
    childList.className = "tree-list";
    renderTree(childList, node.children);

    const header = document.createElement("div");
    header.className = "tree-node__header";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "tree-node__toggle";
    window.AppIcons.setLabel(toggle, "folder", node.name);
    toggle.draggable = true;
    toggle.addEventListener("click", function () {
        setExpanded(li, toggle, node.name, !li.classList.contains("tree-node--expanded"));
    });
    attachDragSource(toggle, node.path);

    const addFileButton = document.createElement("button");
    addFileButton.type = "button";
    addFileButton.className = "tree-node__add";
    addFileButton.setAttribute("aria-label", "New file manually");
    addFileButton.dataset.tooltip = "New file manually";
    addFileButton.innerHTML =
        window.AppIcons.markup("file-plus", "icon--sm") +
        window.AppIcons.markup("pointer", "icon--sm");
    addFileButton.addEventListener("click", function (event) {
        event.stopPropagation();
        setExpanded(li, toggle, node.name, true);
        startCreateEntry(node.path, childList, "file");
    });

    const addFolderButton = document.createElement("button");
    addFolderButton.type = "button";
    addFolderButton.className = "tree-node__add";
    addFolderButton.setAttribute("aria-label", "New folder manually");
    addFolderButton.dataset.tooltip = "New folder manually";
    addFolderButton.innerHTML =
        window.AppIcons.markup("folder-plus", "icon--sm") +
        window.AppIcons.markup("pointer", "icon--sm");
    addFolderButton.addEventListener("click", function (event) {
        event.stopPropagation();
        setExpanded(li, toggle, node.name, true);
        startCreateEntry(node.path, childList, "dir");
    });

    const addStructuredFileButton = document.createElement("button");
    addStructuredFileButton.type = "button";
    addStructuredFileButton.className = "tree-node__add";
    addStructuredFileButton.setAttribute("aria-label", "New file using Magic AI");
    addStructuredFileButton.dataset.tooltip = "New file using Magic AI";
    addStructuredFileButton.innerHTML =
        window.AppIcons.markup("file-plus", "icon--sm") +
        window.AppIcons.markup("sparkles", "icon--sm");
    addStructuredFileButton.addEventListener("click", async function (event) {
        event.stopPropagation();
        const data = await createStructuredFile(addStructuredFileButton, node.path);
        if (data) await refreshTree();
    });

    const actions = document.createElement("div");
    actions.className = "tree-node__actions";
    actions.appendChild(addFileButton);
    actions.appendChild(addFolderButton);
    actions.appendChild(addStructuredFileButton);

    header.appendChild(toggle);
    header.appendChild(actions);
    attachDropTarget(li, node.path);

    li.appendChild(header);
    li.appendChild(childList);
    return li;
}

function setExpanded(li, toggle, name, expanded) {
    li.classList.toggle("tree-node--expanded", expanded);
    window.AppIcons.setLabel(toggle, expanded ? "folder-open" : "folder", name);
}

function displayName(name) {
    return name.replace(/\.json$/i, "");
}

function createFileNode(node) {
    const li = document.createElement("li");
    li.className = "tree-node tree-node--file";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "tree-node__label";
    window.AppIcons.setLabel(button, "file", displayName(node.name));
    button.dataset.path = node.path;
    button.draggable = true;
    button.addEventListener("click", function () {
        selectFile(node.path, button, { push: true });
    });
    attachDragSource(button, node.path);

    li.appendChild(button);
    return li;
}

function renderTree(container, nodes) {
    nodes.forEach(function (node) {
        container.appendChild(node.type === "dir" ? createDirNode(node) : createFileNode(node));
    });
}

function attachDragSource(el, path) {
    el.addEventListener("dragstart", function (event) {
        event.dataTransfer.setData("text/plain", path);
        event.dataTransfer.effectAllowed = "move";
        event.stopPropagation();
    });
}

function attachDropTarget(li, dirPath) {
    li.addEventListener("dragover", function (event) {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        li.classList.add("tree-node--drop-target");
    });
    li.addEventListener("dragleave", function (event) {
        if (!li.contains(event.relatedTarget)) {
            li.classList.remove("tree-node--drop-target");
        }
    });
    li.addEventListener("drop", async function (event) {
        event.preventDefault();
        event.stopPropagation();
        li.classList.remove("tree-node--drop-target");
        const sourcePath = event.dataTransfer.getData("text/plain");
        await moveEntry(sourcePath, dirPath);
    });
}

let toastTimer = null;

function showToast(message) {
    let toast = document.getElementById("sidebar-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "sidebar-toast";
        toast.className = "sidebar-toast";
        document.querySelector(".app-body__sidebar").appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("sidebar-toast--visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
        toast.classList.remove("sidebar-toast--visible");
    }, 2500);
}

async function moveEntry(sourcePath, targetDir) {
    if (!sourcePath) return;
    const response = await fetch("/api/data-tree/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: sourcePath, targetDir: targetDir }),
    });
    if (response.ok) {
        await refreshTree();
    } else if (response.status === 409) {
        showToast(`"${displayName(sourcePath.split("/").pop())}" already exists there`);
    }
}

function startCreateEntry(dirPath, childList, type) {
    const li = document.createElement("li");
    li.className = "tree-node tree-node--new";
    const input = document.createElement("input");
    input.type = "text";
    input.className = "tree-node__input";
    input.placeholder = type === "dir" ? "folder name" : "name";
    li.appendChild(input);

    // Files may carry an optional one-line description. Folders stay name-only.
    // The description input sits directly under the name input and is fully
    // optional - leaving it empty reproduces the previous name-only behaviour.
    let descInput = null;
    if (type !== "dir") {
        descInput = document.createElement("input");
        descInput.type = "text";
        descInput.className = "tree-node__input tree-node__input--desc";
        descInput.placeholder = "description (optional)";
        li.appendChild(descInput);
    }

    childList.insertBefore(li, childList.firstChild);
    input.focus();

    let done = false;

    function cancel() {
        if (done) return;
        done = true;
        li.remove();
    }

    async function submit() {
        if (done) return;
        const name = input.value.trim();
        if (!name) {
            cancel();
            return;
        }
        const body = { dir: dirPath, name: name, type: type };
        if (descInput) {
            const description = descInput.value.trim();
            if (description) body.description = description;
        }
        const response = await fetch("/api/data-tree/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (response.ok) {
            done = true;
            const result = await response.json();
            await selectNewEntry(result);
        } else if (response.status === 409) {
            showToast(`"${name}" already exists there`);
            input.select();
        } else {
            cancel();
        }
    }

    function onKeydown(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            submit();
        } else if (event.key === "Escape") {
            event.preventDefault();
            cancel();
        }
    }

    // Cancel only when focus leaves the create row entirely, so tabbing or
    // clicking between the name and description inputs does not abort.
    function onBlur() {
        setTimeout(function () {
            if (!li.contains(document.activeElement)) cancel();
        }, 150);
    }

    input.addEventListener("keydown", onKeydown);
    input.addEventListener("blur", onBlur);
    if (descInput) {
        descInput.addEventListener("keydown", onKeydown);
        descInput.addEventListener("blur", onBlur);
    }
}

// ------------------------------------------------------------------
// Application state. `currentMode` tracks whether the main pane shows
// a document ("doc") or a directory listing ("dir"); the id/path pairs
// below only apply to the matching mode.
// ------------------------------------------------------------------

let fileTreeRoot;
let currentTree = [];
let currentMode = "doc";
let currentFilePath = "";
let currentFileText = "";
let currentDirPath = "";

const VALID_VIEWS = ["json", "tree", "table", "text"];
const DEFAULT_VIEW_STORAGE_KEY = "magicdata.defaultView";
const FALLBACK_DEFAULT_VIEW = "table";

function defaultView() {
    try {
        const stored = localStorage.getItem(DEFAULT_VIEW_STORAGE_KEY);
        if (VALID_VIEWS.includes(stored)) return stored;
    } catch (e) {
        /* storage unavailable */
    }
    return FALLBACK_DEFAULT_VIEW;
}

function currentView() {
    const active = document.querySelector("#view-switch .view-switch__option.active");
    return active ? active.dataset.view : defaultView();
}

function setActiveView(view) {
    const switchEl = document.getElementById("view-switch");
    switchEl.querySelectorAll(".view-switch__option").forEach(function (btn) {
        const active = btn.dataset.view === view;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-checked", String(active));
    });
    updateToolbarActions();
}

// ------------------------------------------------------------------
// URL building. Which document/directory is open is decided entirely by
// the server (it injects window.__INITIAL_STATE__ on every real
// navigation, see pages.py/server.py) - the client never decides 404
// itself, it only mirrors that decision into pushState/replaceState so
// the address bar and back/forward stay in sync with what's on screen.
//
// All data routes live under the `/data` namespace, keeping them clear of
// application pages and assets. A document is addressed by its readable
// path with the `.json` extension dropped (e.g. `/data/language/english`);
// a directory by its path (`/data/city`, or `/data` for the root). The
// active view is always in the query string (`?view=table`).
// ------------------------------------------------------------------

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

function updateUrl(push) {
    const url = currentMode === "dir" ? buildDirUrl(currentDirPath) : buildDocUrl(currentFilePath);
    if (push) {
        window.history.pushState(null, "", url);
    } else {
        window.history.replaceState(null, "", url);
    }
}

function findButton(path) {
    return fileTreeRoot.querySelector(`.tree-node__label[data-path="${CSS.escape(path)}"]`);
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

function renderCurrentFile() {
    const content = document.getElementById("file-content");
    const view = currentView();
    window.ContentView.render(view, currentFileText, content);
    updateFileHistoryMeta(view, currentFileText);
}

function hideFileHistoryMeta() {
    const el = document.getElementById("file-history-meta");
    if (!el) return;
    el.hidden = true;
    el.textContent = "";
}

function updateFileHistoryMeta(viewName, rawText) {
    const el = document.getElementById("file-history-meta");
    if (!el) return;
    if (viewName === "json" || currentMode !== "doc") {
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

function expandAncestors(el) {
    let dirLi = el.closest(".tree-list").closest(".tree-node--dir");
    while (dirLi) {
        const toggle = dirLi.querySelector(":scope > .tree-node__header > .tree-node__toggle");
        setExpanded(dirLi, toggle, dirLi.dataset.name, true);
        dirLi = dirLi.parentElement.closest(".tree-node--dir");
    }
}

function expandDirAndAncestors(dirLi) {
    const toggle = dirLi.querySelector(":scope > .tree-node__header > .tree-node__toggle");
    setExpanded(dirLi, toggle, dirLi.dataset.name, true);
    expandAncestors(toggle);
}

async function selectFile(path, button, options) {
    const opts = options || {};
    currentMode = "doc";
    showDocChrome();
    document.querySelectorAll(".tree-node__label").forEach(function (btn) {
        btn.classList.toggle("active", btn === button);
    });

    currentFilePath = path;
    currentFileText = await loadFileContent(path);
    renderCurrentFile();
    if (!opts.silent) updateUrl(Boolean(opts.push));
}

function renderDirectoryListing(path) {
    currentMode = "dir";
    currentDirPath = path;

    document.querySelectorAll(".tree-node__label").forEach(function (btn) {
        btn.classList.remove("active");
    });
    document.getElementById("view-switch").hidden = true;
    document.getElementById("content-toolbar-actions").hidden = true;
    hideFileHistoryMeta();

    const node = findDirNode(currentTree, path);
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

function navigateToDir(path) {
    const dirLi = path ? fileTreeRoot.querySelector(`.tree-node--dir[data-path="${CSS.escape(path)}"]`) : null;
    if (dirLi) expandDirAndAncestors(dirLi);
    renderDirectoryListing(path);
    updateUrl(true);
}

function navigateToDoc(path) {
    const button = findButton(path);
    if (!button) return;
    expandAncestors(button);
    selectFile(path, button, { push: true });
}

async function refreshTree() {
    currentTree = await loadFileTree();
    fileTreeRoot.innerHTML = "";
    renderTree(fileTreeRoot, currentTree);

    if (currentMode === "doc" && currentFilePath) {
        const button = findButton(currentFilePath);
        if (button) {
            expandAncestors(button);
            button.classList.add("active");
            updateUrl(false);
        }
    } else if (currentMode === "dir") {
        renderDirectoryListing(currentDirPath);
    }
}

async function selectNewEntry(result) {
    await refreshTree();
    if (!result || !result.path) return;

    if (result.type === "dir") {
        navigateToDir(result.path);
        return;
    }

    navigateToDoc(result.path);
}

function applyInitialState() {
    const state = window.__INITIAL_STATE__ || { kind: "dir", path: "" };
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    setActiveView(VALID_VIEWS.includes(view) ? view : defaultView());

    if (state.kind === "dir") {
        if (state.path) {
            const dirLi = fileTreeRoot.querySelector(`.tree-node--dir[data-path="${CSS.escape(state.path)}"]`);
            if (dirLi) expandDirAndAncestors(dirLi);
        }
        renderDirectoryListing(state.path);
        return;
    }

    const button = findButton(state.path);
    if (button) {
        expandAncestors(button);
        selectFile(state.path, button, { silent: true });
        updateUrl(false);
    }
}

const VIEWS_WITH_COLLAPSE_CONTROLS = ["json", "tree"];

function updateToolbarActions() {
    const group = document.getElementById("collapse-expand-group");
    group.hidden = !VIEWS_WITH_COLLAPSE_CONTROLS.includes(currentView());
}

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

    window.ContentView.render(viewName, currentFileText, content);
    updateFileHistoryMeta(viewName, currentFileText);
    document.title = baseFileName(currentFilePath);

    function restore() {
        window.removeEventListener("afterprint", restore);
        document.title = originalTitle;
        window.ContentView.render(originalView, currentFileText, content);
        updateFileHistoryMeta(originalView, currentFileText);
    }
    window.addEventListener("afterprint", restore);
    window.print();
}

function downloadAs(format) {
    if (!currentFilePath) return;
    const base = baseFileName(currentFilePath);
    switch (format) {
        case "json":
            triggerDownload(`${base}.json`, currentFileText, "application/json");
            break;
        case "csv":
            triggerDownload(`${base}.csv`, window.ContentView.toDelimited(currentFileText, ","), "text/csv");
            break;
        case "tsv":
            triggerDownload(`${base}.tsv`, window.ContentView.toDelimited(currentFileText, "\t"), "text/tab-separated-values");
            break;
        case "markdown-table":
            triggerDownload(`${base}.md`, window.ContentView.toMarkdownTable(currentFileText, base), "text/markdown");
            break;
        case "pdf-table":
            printAsView("table");
            break;
        case "pdf-text":
            printAsView("text");
            break;
    }
}

function initDownloadMenu() {
    const button = document.getElementById("download-button");
    const dropdown = document.getElementById("download-dropdown");

    function closeDropdown() {
        dropdown.hidden = true;
        button.setAttribute("aria-expanded", "false");
    }
    toolbarMenuClosers.push(closeDropdown);

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
    if (!currentFilePath) return Promise.resolve();

    const content = format === "table"
        ? window.ContentView.toDelimited(currentFileText, "\t")
        : currentFileText;

    return copyToClipboard(content).then(function () {
        showToast("Copied to clipboard");
    }).catch(function () {
        showToast("Could not copy to clipboard");
    });
}

function initCopyMenu() {
    const button = document.getElementById("copy-button");
    const dropdown = document.getElementById("copy-dropdown");

    function closeDropdown() {
        dropdown.hidden = true;
        button.setAttribute("aria-expanded", "false");
    }
    toolbarMenuClosers.push(closeDropdown);

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

function initViewSwitch() {
    const switchEl = document.getElementById("view-switch");
    switchEl.querySelectorAll(".view-switch__option").forEach(function (option) {
        option.addEventListener("click", function () {
            if (currentMode !== "doc") return;
            setActiveView(option.dataset.view);
            renderCurrentFile();
            updateUrl(false);
        });
    });
    updateToolbarActions();
}

window.MagicData = {
    currentContext: function () {
        return {
            document: {
                path: currentFilePath,
                name: currentFilePath.split("/").pop()
            },
            view: currentView()
        };
    },
    reloadDocument: async function () {
        if (currentMode === "doc" && currentFilePath) {
            currentFileText = await loadFileContent(currentFilePath);
            renderCurrentFile();
        }
    }
};

// Toolbar menus are mutually exclusive: opening one closes any other. Each menu
// registers its close function; because triggers stop propagation, an outside
// click alone cannot close a sibling menu.
const toolbarMenuClosers = [];

function closeOtherMenus(keep) {
    toolbarMenuClosers.forEach(function (close) {
        if (close !== keep) close();
    });
}

function initMagicButtons() {
    const sidebarToolbar = document.querySelector(".sidebar-toolbar");
    if (sidebarToolbar) {
        const structuredButton = document.createElement("button");
        structuredButton.type = "button";
        structuredButton.className = "sidebar-toolbar__button sidebar-toolbar__button--icon";
        structuredButton.innerHTML = window.AppIcons.markup("file-plus") + window.AppIcons.markup("sparkles");
        structuredButton.setAttribute("aria-label", "New file using Magic AI");
        structuredButton.dataset.tooltip = "New file using Magic AI";
        structuredButton.addEventListener("click", async function () {
            const data = await createStructuredFile(structuredButton, "");
            if (data) await refreshTree();
        });
        sidebarToolbar.appendChild(structuredButton);
    }

    const toolbarActions = document.getElementById("content-toolbar-actions");
    if (toolbarActions) {
        const structureRoot = document.createElement("div");
        structureRoot.className = "content-toolbar__menu";

        const structureButton = document.createElement("button");
        structureButton.type = "button";
        structureButton.className = "content-toolbar__button content-toolbar__button--icon";
        structureButton.id = "data-structure-button";
        structureButton.setAttribute("aria-haspopup", "dialog");
        structureButton.setAttribute("aria-expanded", "false");
        structureButton.setAttribute("aria-label", "Data structure");
        structureButton.dataset.tooltip = "data-structure";
        structureButton.innerHTML = window.AppIcons.markup("columns-3-cog");

        const popup = document.createElement("div");
        popup.className = "data-structure-popup";
        popup.id = "data-structure-popup";
        popup.setAttribute("role", "dialog");
        popup.setAttribute("aria-label", "Data structure");
        popup.hidden = true;

        const popupHeader = document.createElement("div");
        popupHeader.className = "data-structure-popup__header";

        const popupTitle = document.createElement("span");
        popupTitle.className = "data-structure-popup__title";
        popupTitle.textContent = "Data structure";

        const structureSwitch = document.createElement("div");
        structureSwitch.className = "view-switch data-structure-popup__switch";
        structureSwitch.setAttribute("role", "radiogroup");
        structureSwitch.setAttribute("aria-label", "Data structure view");

        let structureView = "tree";
        ["Tree", "JSON"].forEach(function (label) {
            const option = document.createElement("button");
            option.type = "button";
            option.className = "view-switch__option";
            option.dataset.structureView = label.toLowerCase();
            option.setAttribute("role", "radio");
            option.textContent = label;
            structureSwitch.appendChild(option);
        });

        const popupContent = document.createElement("div");
        popupContent.className = "data-structure-popup__content";

        // Keep interactions with the rendered structure inside the dialog.
        // In particular, collapsing a node must not reach the document-level
        // outside-click handler that closes toolbar menus.
        popup.addEventListener("click", function (event) {
            event.stopPropagation();
        });

        function renderStructure() {
            structureSwitch.querySelectorAll("[data-structure-view]").forEach(function (option) {
                const active = option.dataset.structureView === structureView;
                option.classList.toggle("active", active);
                option.setAttribute("aria-checked", String(active));
            });
            window.ContentView.renderStructure(currentFileText, structureView, popupContent);
        }

        structureSwitch.addEventListener("click", function (event) {
            const option = event.target.closest("[data-structure-view]");
            if (!option) return;
            structureView = option.dataset.structureView;
            renderStructure();
        });

        const fixButton = document.createElement("button");
        fixButton.type = "button";
        fixButton.className = "content-toolbar__dropdown-item data-structure-popup__fix";
        window.AppIcons.setLabel(fixButton, "sparkles", "Update structure");
        fixButton.addEventListener("click", async function () {
            const data = await window.magicLlm.runScenario("fix-structure", {
                context: window.MagicData.currentContext(),
                button: fixButton
            });
            if (data) {
                await window.MagicData.reloadDocument();
                renderStructure();
            }
        });

        popupHeader.append(popupTitle, fixButton, structureSwitch);
        popup.append(popupHeader, popupContent);
        structureRoot.append(structureButton, popup);

        function closeStructurePopup() {
            popup.hidden = true;
            structureButton.setAttribute("aria-expanded", "false");
        }

        structureButton.addEventListener("click", function (event) {
            event.stopPropagation();
            const willOpen = popup.hidden;
            if (willOpen) {
                closeOtherMenus(closeStructurePopup);
                renderStructure();
            }
            popup.hidden = !willOpen;
            structureButton.setAttribute("aria-expanded", String(willOpen));
        });
        document.addEventListener("click", function (event) {
            if (!popup.hidden && !popup.contains(event.target) && !structureButton.contains(event.target)) {
                closeStructurePopup();
            }
        });
        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && !popup.hidden) closeStructurePopup();
        });
        toolbarMenuClosers.push(closeStructurePopup);

        const customButton = document.createElement("button");
        customButton.type = "button";
        customButton.className = "content-toolbar__button content-toolbar__button--icon";
        customButton.id = "magic-custom-button";
        customButton.setAttribute("aria-label", "Magic assistant");
        customButton.dataset.tooltip = "Magic assistant";
        customButton.innerHTML = window.AppIcons.markup("sparkles");
        customButton.addEventListener("click", async function () {
            const data = await window.magicLlm.runScenario("custom-edit", {
                context: window.MagicData.currentContext(),
                button: customButton
            });
            if (data) await window.MagicData.reloadDocument();
        });

        const fragment = document.createDocumentFragment();
        fragment.append(customButton, structureRoot);
        toolbarActions.insertBefore(fragment, toolbarActions.firstChild);
    }
}

function dataDirectoryPath(directoryPath) {
    return directoryPath ? `data/${directoryPath}/` : "data/";
}

function createStructuredFile(button, directoryPath) {
    const targetDirectory = dataDirectoryPath(directoryPath);
    return window.magicLlm.runScenario("create-structured-file", {
        button: button,
        context: { targetDirectory: targetDirectory },
        selectedDirectory: targetDirectory,
    });
}

function initSidebarCollapse() {
    const sidebar = document.getElementById("app-sidebar");
    const toggle = document.getElementById("sidebar-collapse");
    if (!sidebar || !toggle) return;

    const STORAGE_KEY = "magicdata.sidebarCollapsed";
    const HOVER_EXPAND = "app-body__sidebar--hover-expand";

    function armHoverExpand() {
        if (sidebar.classList.contains("app-body__sidebar--collapsed")) {
            sidebar.classList.add(HOVER_EXPAND);
        }
    }

    let collapsed = false;

    function setCollapsed(shouldCollapse) {
        collapsed = shouldCollapse;
        sidebar.classList.toggle("app-body__sidebar--collapsed", shouldCollapse);
        sidebar.classList.remove(HOVER_EXPAND);
        toggle.setAttribute("aria-expanded", String(!shouldCollapse));
        const label = shouldCollapse ? "Expand sidebar" : "Collapse sidebar";
        toggle.setAttribute("aria-label", label);
        toggle.dataset.tooltip = label;
        window.AppIcons.setLabel(toggle, shouldCollapse ? "chevron-right" : "chevron-left");
        try {
            localStorage.setItem(STORAGE_KEY, shouldCollapse ? "1" : "0");
        } catch (e) {
            /* storage unavailable — keep session-only state */
        }
    }

    try {
        collapsed = localStorage.getItem(STORAGE_KEY) === "1";
    } catch (e) {
        collapsed = false;
    }
    setCollapsed(collapsed);
    toggle.addEventListener("click", function () {
        setCollapsed(!collapsed);
    });

    sidebar.addEventListener("mouseenter", armHoverExpand);
    sidebar.addEventListener("focusin", armHoverExpand);
}

document.addEventListener("DOMContentLoaded", async function () {
    fileTreeRoot = document.getElementById("file-tree");

    fileTreeRoot.addEventListener("dragover", function (event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        fileTreeRoot.classList.add("tree-list--drop-target");
    });
    fileTreeRoot.addEventListener("dragleave", function (event) {
        if (!fileTreeRoot.contains(event.relatedTarget)) {
            fileTreeRoot.classList.remove("tree-list--drop-target");
        }
    });
    fileTreeRoot.addEventListener("drop", async function (event) {
        event.preventDefault();
        fileTreeRoot.classList.remove("tree-list--drop-target");
        const sourcePath = event.dataTransfer.getData("text/plain");
        await moveEntry(sourcePath, "");
    });

    currentTree = await loadFileTree();
    renderTree(fileTreeRoot, currentTree);

    initViewSwitch();
    applyInitialState();
    initSidebarCollapse();

    // Route resolution (doc vs directory vs 404) is decided by the server
    // for every real navigation - back/forward needs a real navigation too,
    // so it stays authoritative instead of re-deciding on the client.
    window.addEventListener("popstate", function () {
        window.location.reload();
    });

    document.getElementById("new-file").addEventListener("click", function () {
        startCreateEntry("", fileTreeRoot, "file");
    });
    document.getElementById("new-folder").addEventListener("click", function () {
        startCreateEntry("", fileTreeRoot, "dir");
    });

    document.getElementById("collapse-all").addEventListener("click", function () {
        window.ContentView.collapseAll(document.getElementById("file-content"));
    });
    document.getElementById("expand-all").addEventListener("click", function () {
        window.ContentView.expandAll(document.getElementById("file-content"));
    });
    document.getElementById("open-raw-json").addEventListener("click", function () {
        if (currentFilePath) window.open(dataFileUrl(currentFilePath), "_blank", "noopener");
    });

    initCopyMenu();
    initDownloadMenu();
    initMagicButtons();
});
