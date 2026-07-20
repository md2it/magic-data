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
    toggle.textContent = `▸ ${node.name}`;
    toggle.draggable = true;
    toggle.addEventListener("click", function () {
        setExpanded(li, toggle, node.name, !li.classList.contains("tree-node--expanded"));
    });
    attachDragSource(toggle, node.path);

    const addFileButton = document.createElement("button");
    addFileButton.type = "button";
    addFileButton.className = "tree-node__add";
    addFileButton.title = "New file";
    addFileButton.textContent = "+";
    addFileButton.addEventListener("click", function (event) {
        event.stopPropagation();
        setExpanded(li, toggle, node.name, true);
        startCreateEntry(node.path, childList, "file");
    });

    const addFolderButton = document.createElement("button");
    addFolderButton.type = "button";
    addFolderButton.className = "tree-node__add";
    addFolderButton.title = "New folder";
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
    toggle.textContent = `${expanded ? "▾" : "▸"} ${name}`;
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
    button.title = node.name;
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
        const result = await response.json();
        await refreshTree(result, sourcePath);
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
            await refreshTree(result);
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

async function refreshTree(result, oldPath) {
    const tree = await loadFileTree();
    fileTreeRoot.innerHTML = "";
    renderTree(fileTreeRoot, tree);

    if (oldPath && currentFilePath) {
        const remapped = remapPath(currentFilePath, oldPath, result.path);
        if (remapped !== currentFilePath) {
            const button = findButton(remapped);
            if (button) {
                expandAncestors(button);
                await selectFile(remapped, button, { push: false });
            }
            return;
        }
    }

    if (!result || !result.path) return;

    if (result.type === "dir") {
        const dirLi = fileTreeRoot.querySelector(`.tree-node--dir[data-path="${CSS.escape(result.path)}"]`);
        if (dirLi) {
            expandAncestors(dirLi);
            const toggle = dirLi.querySelector(":scope > .tree-node__header > .tree-node__toggle");
            setExpanded(dirLi, toggle, dirLi.dataset.name, true);
        }
        return;
    }

    const button = fileTreeRoot.querySelector(`.tree-node__label[data-path="${CSS.escape(result.path)}"]`);
    if (button) {
        expandAncestors(button);
        button.click();
    }
}

let currentFileText = "";
let currentFilePath = "";

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

function buildUrl(path, view) {
    const params = new URLSearchParams();
    if (path) params.set("path", path);
    if (view) params.set("view", view);
    const qs = params.toString();
    return qs ? `?${qs}` : window.location.pathname;
}

function updateUrl(path, view, push) {
    const url = buildUrl(path, view);
    const state = { path: path, view: view };
    if (push) {
        window.history.pushState(state, "", url);
    } else {
        window.history.replaceState(state, "", url);
    }
}

function parseUrlState() {
    const params = new URLSearchParams(window.location.search);
    const path = params.get("path") || "";
    const view = params.get("view");
    return { path: path, view: VALID_VIEWS.includes(view) ? view : null };
}

function findButton(path) {
    return fileTreeRoot.querySelector(`.tree-node__label[data-path="${CSS.escape(path)}"]`);
}

function renderCurrentFile() {
    const content = document.getElementById("file-content");
    window.ContentView.render(currentView(), currentFileText, content);
}

function showNotFound(path) {
    document.querySelectorAll(".tree-node__label").forEach(function (btn) {
        btn.classList.remove("active");
    });
    currentFilePath = "";
    currentFileText = "";

    document.getElementById("content-toolbar-actions").hidden = true;

    const content = document.getElementById("file-content");
    content.className = "file-content";
    delete content.dataset.currentView;
    content.innerHTML = "";
    const message = document.createElement("div");
    message.className = "not-found";
    message.textContent = `Document not found: ${path}`;
    content.appendChild(message);
}

function hideNotFound() {
    document.getElementById("content-toolbar-actions").hidden = false;
}

async function selectFile(path, button, options) {
    const opts = options || {};
    hideNotFound();
    document.querySelectorAll(".tree-node__label").forEach(function (btn) {
        btn.classList.toggle("active", btn === button);
    });

    currentFilePath = path;
    currentFileText = await loadFileContent(path);
    renderCurrentFile();
    if (!opts.silent) updateUrl(path, currentView(), Boolean(opts.push));
}

function remapPath(path, oldPath, newPath) {
    if (path === oldPath) return newPath;
    if (path.startsWith(`${oldPath}/`)) return newPath + path.slice(oldPath.length);
    return path;
}

function applyUrlState(isInitial, tree) {
    const state = parseUrlState();
    if (state.view) setActiveView(state.view);

    if (!state.path) {
        hideNotFound();
        if (isInitial) {
            const firstPath = findFirstFilePath(tree);
            if (firstPath) {
                const button = findButton(firstPath);
                expandAncestors(button);
                selectFile(firstPath, button, { silent: false, push: false });
            }
        }
        return;
    }

    const button = findButton(state.path);
    if (!button) {
        showNotFound(state.path);
        return;
    }
    expandAncestors(button);
    selectFile(state.path, button, { silent: true });
}

function expandAncestors(button) {
    let dirLi = button.closest(".tree-list").closest(".tree-node--dir");
    while (dirLi) {
        const toggle = dirLi.querySelector(":scope > .tree-node__header > .tree-node__toggle");
        setExpanded(dirLi, toggle, dirLi.dataset.name, true);
        dirLi = dirLi.parentElement.closest(".tree-node--dir");
    }
}

function findFirstFilePath(nodes) {
    const queue = [...nodes];
    while (queue.length > 0) {
        const node = queue.shift();
        if (node.type === "file") return node.path;
        if (node.type === "dir") queue.push(...node.children);
    }
    return null;
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

    button.addEventListener("click", function (event) {
        event.stopPropagation();
        const willOpen = dropdown.hidden;
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
            setActiveView(option.dataset.view);
            renderCurrentFile();
            if (currentFilePath) updateUrl(currentFilePath, currentView(), false);
        });
    });
    updateToolbarActions();
}

let fileTreeRoot;

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

    const tree = await loadFileTree();
    renderTree(fileTreeRoot, tree);

    initViewSwitch();
    applyUrlState(true, tree);

    window.addEventListener("popstate", function () {
        applyUrlState(false, tree);
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
});
