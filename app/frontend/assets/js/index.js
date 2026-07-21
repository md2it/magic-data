async function loadFileTree() {
    const response = await fetch("/api/data-tree");
    return response.json();
}

async function loadFileContent(path) {
    const response = await fetch(`/api/data-files/${path.split("/").map(encodeURIComponent).join("/")}`);
    return response.text();
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
    window.AppIcons.setLabel(toggle, "chevron-right", node.name);
    toggle.draggable = true;
    toggle.addEventListener("click", function () {
        setExpanded(li, toggle, node.name, !li.classList.contains("tree-node--expanded"));
    });
    attachDragSource(toggle, node.path);

    const addFileButton = document.createElement("button");
    addFileButton.type = "button";
    addFileButton.className = "tree-node__add";
    addFileButton.setAttribute("aria-label", "New file");
    addFileButton.dataset.tooltip = "New file";
    addFileButton.textContent = "+";
    addFileButton.addEventListener("click", function (event) {
        event.stopPropagation();
        setExpanded(li, toggle, node.name, true);
        startCreateEntry(node.path, childList, "file");
    });

    const addFolderButton = document.createElement("button");
    addFolderButton.type = "button";
    addFolderButton.className = "tree-node__add";
    addFolderButton.setAttribute("aria-label", "New folder");
    addFolderButton.dataset.tooltip = "New folder";
    addFolderButton.textContent = "📁";
    addFolderButton.addEventListener("click", function (event) {
        event.stopPropagation();
        setExpanded(li, toggle, node.name, true);
        startCreateEntry(node.path, childList, "dir");
    });

    header.appendChild(toggle);
    header.appendChild(addFileButton);
    header.appendChild(addFolderButton);
    attachDropTarget(li, node.path);

    li.appendChild(header);
    li.appendChild(childList);
    return li;
}

function setExpanded(li, toggle, name, expanded) {
    li.classList.toggle("tree-node--expanded", expanded);
    window.AppIcons.setLabel(toggle, expanded ? "chevron-down" : "chevron-right", name);
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
    button.textContent = displayName(node.name);
    button.dataset.tooltip = node.name;
    button.dataset.path = node.path;
    button.dataset.id = node.id || "";
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
        const response = await fetch("/api/data-tree/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dir: dirPath, name: name, type: type }),
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

    input.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            submit();
        } else if (event.key === "Escape") {
            event.preventDefault();
            cancel();
        }
    });
    input.addEventListener("blur", function () {
        setTimeout(cancel, 150);
    });
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
let currentFileId = "";
let currentFileText = "";
let currentDirPath = "";

const VALID_VIEWS = ["json", "tree", "table", "text"];

function currentView() {
    const active = document.querySelector("#view-switch .view-switch__option.active");
    return active ? active.dataset.view : "json";
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
// a directory by its path (`/data/city`, or `/data` for the root).
// ------------------------------------------------------------------

function buildDocUrl(path) {
    const parts = path.split("/");
    parts[parts.length - 1] = displayName(parts[parts.length - 1]);
    const view = currentView();
    const qs = view && view !== "json" ? `?view=${encodeURIComponent(view)}` : "";
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
    window.ContentView.render(currentView(), currentFileText, content);
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
    currentFileId = button && button.dataset ? (button.dataset.id || "") : "";
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
        link.textContent = child.type === "dir" ? `📁 ${child.name}` : displayName(child.name);
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
    setActiveView(VALID_VIEWS.includes(view) ? view : "json");

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
    document.title = baseFileName(currentFilePath);

    function restore() {
        window.removeEventListener("afterprint", restore);
        document.title = originalTitle;
        window.ContentView.render(originalView, currentFileText, content);
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
        case "pdf-text":
            printAsView("text");
            break;
        case "pdf-table":
            printAsView("table");
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
                name: currentFilePath.split("/").pop(),
                id: currentFileId || null
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

// Builds a toolbar dropdown menu: an icon trigger with a caret, plus a panel
// with an uppercase header. The caller appends items to `.dropdown` and may
// call `.close()`. Open/close, outside-click, and Escape are wired here.
function buildDropdownMenu(config) {
    const root = document.createElement("div");
    root.className = "content-toolbar__menu";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "content-toolbar__button content-toolbar__button--menu";
    trigger.id = config.id + "-button";
    trigger.setAttribute("aria-haspopup", "menu");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", config.triggerLabel);
    trigger.dataset.tooltip = config.triggerLabel;
    trigger.innerHTML = window.AppIcons.markup(config.triggerIcon) +
        window.AppIcons.markup("chevron-down", "icon--sm content-toolbar__caret");

    const dropdown = document.createElement("div");
    dropdown.className = "content-toolbar__dropdown";
    dropdown.id = config.id + "-dropdown";
    dropdown.setAttribute("role", "menu");
    dropdown.hidden = true;

    const header = document.createElement("p");
    header.className = "content-toolbar__dropdown-header";
    header.textContent = config.header;
    dropdown.appendChild(header);

    function close() {
        dropdown.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
    }

    trigger.addEventListener("click", function (event) {
        event.stopPropagation();
        const willOpen = dropdown.hidden;
        if (willOpen) closeOtherMenus(close);
        dropdown.hidden = !willOpen;
        trigger.setAttribute("aria-expanded", String(willOpen));
    });
    document.addEventListener("click", function (event) {
        if (!dropdown.hidden && !dropdown.contains(event.target) && !trigger.contains(event.target)) close();
    });
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && !dropdown.hidden) close();
    });

    toolbarMenuClosers.push(close);
    root.append(trigger, dropdown);
    return { root: root, dropdown: dropdown, trigger: trigger, close: close };
}

function initMagicButtons() {
    const sidebarToolbar = document.querySelector(".sidebar-toolbar");
    if (sidebarToolbar) {
        const structuredButton = document.createElement("button");
        structuredButton.type = "button";
        structuredButton.className = "sidebar-toolbar__button sidebar-toolbar__button--icon";
        structuredButton.innerHTML = window.AppIcons.markup("file-plus") + window.AppIcons.markup("sparkles");
        structuredButton.setAttribute("aria-label", "Create a structured file");
        structuredButton.dataset.tooltip = "Create a structured file";
        structuredButton.addEventListener("click", async function () {
            const data = await window.magicLlm.runScenario("create-structured-file", { button: structuredButton });
            if (data) await refreshTree();
        });
        sidebarToolbar.appendChild(structuredButton);
    }

    const toolbarActions = document.getElementById("content-toolbar-actions");
    if (toolbarActions) {
        const docScenarios = [
            { label: "Fix structure", scenario: "fix-structure" },
            { label: "Fill all", scenario: "fill-all" },
            { label: "Custom", scenario: "custom-edit" }
        ];

        const menu = buildDropdownMenu({
            id: "magic",
            triggerLabel: "Magic buttons",
            triggerIcon: "sparkles",
            header: "Magic buttons",
        });

        docScenarios.forEach(function (item) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "content-toolbar__dropdown-item";
            button.setAttribute("role", "menuitem");
            window.AppIcons.setLabel(button, "sparkles", item.label);
            button.addEventListener("click", async function () {
                menu.close();
                const data = await window.magicLlm.runScenario(item.scenario, {
                    context: window.MagicData.currentContext(),
                    button: button
                });
                if (data) await window.MagicData.reloadDocument();
            });
            menu.dropdown.appendChild(button);
        });

        toolbarActions.insertBefore(menu.root, toolbarActions.firstChild);
    }
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

    initDownloadMenu();
    initMagicButtons();
});
