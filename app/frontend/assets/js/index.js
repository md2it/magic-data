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

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "tree-node__add";
    addButton.title = "New file";
    addButton.textContent = "+";
    addButton.addEventListener("click", function (event) {
        event.stopPropagation();
        setExpanded(li, toggle, node.name, true);
        startCreateFile(node.path, childList);
    });

    header.appendChild(toggle);
    header.appendChild(addButton);
    attachDropTarget(li, node.path);

    li.appendChild(header);
    li.appendChild(childList);
    return li;
}

function setExpanded(li, toggle, name, expanded) {
    li.classList.toggle("tree-node--expanded", expanded);
    toggle.textContent = `${expanded ? "▾" : "▸"} ${name}`;
}

function createFileNode(node) {
    const li = document.createElement("li");
    li.className = "tree-node tree-node--file";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "tree-node__label";
    button.textContent = node.name;
    button.dataset.path = node.path;
    button.draggable = true;
    button.addEventListener("click", function () {
        selectFile(node.path, button);
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

async function moveEntry(sourcePath, targetDir) {
    if (!sourcePath) return;
    const response = await fetch("/api/data-tree/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: sourcePath, targetDir: targetDir }),
    });
    if (response.ok) {
        const result = await response.json();
        await refreshTree(result.path);
    }
}

function startCreateFile(dirPath, childList) {
    const li = document.createElement("li");
    li.className = "tree-node tree-node--new";
    const input = document.createElement("input");
    input.type = "text";
    input.className = "tree-node__input";
    input.placeholder = "name.json";
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
        done = true;
        const response = await fetch("/api/data-tree/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dir: dirPath, name: name }),
        });
        if (response.ok) {
            const result = await response.json();
            await refreshTree(result.path);
        } else {
            li.remove();
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

async function refreshTree(selectPath) {
    const tree = await loadFileTree();
    fileTreeRoot.innerHTML = "";
    renderTree(fileTreeRoot, tree);
    if (selectPath) {
        const button = fileTreeRoot.querySelector(`.tree-node__label[data-path="${CSS.escape(selectPath)}"]`);
        if (button) {
            expandAncestors(button);
            button.click();
        }
    }
}

let currentFileText = "";

function currentView() {
    const active = document.querySelector("#view-switch .view-switch__option.active");
    return active ? active.dataset.view : "json";
}

function renderCurrentFile() {
    const content = document.getElementById("file-content");
    window.ContentView.render(currentView(), currentFileText, content);
}

async function selectFile(path, button) {
    document.querySelectorAll(".tree-node__label").forEach(function (btn) {
        btn.classList.toggle("active", btn === button);
    });

    currentFileText = await loadFileContent(path);
    renderCurrentFile();
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
    const actions = document.getElementById("content-toolbar-actions");
    actions.hidden = !VIEWS_WITH_COLLAPSE_CONTROLS.includes(currentView());
}

function initViewSwitch() {
    const switchEl = document.getElementById("view-switch");
    switchEl.querySelectorAll(".view-switch__option").forEach(function (option) {
        option.addEventListener("click", function () {
            switchEl.querySelectorAll(".view-switch__option").forEach(function (btn) {
                const active = btn === option;
                btn.classList.toggle("active", active);
                btn.setAttribute("aria-checked", String(active));
            });
            updateToolbarActions();
            renderCurrentFile();
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

    const firstPath = findFirstFilePath(tree);
    if (firstPath) {
        const button = fileTreeRoot.querySelector(`.tree-node__label[data-path="${CSS.escape(firstPath)}"]`);
        expandAncestors(button);
        button.click();
    }

    document.getElementById("new-file").addEventListener("click", function () {
        startCreateFile("", fileTreeRoot);
    });

    document.getElementById("collapse-all").addEventListener("click", function () {
        window.ContentView.collapseAll(document.getElementById("file-content"));
    });
    document.getElementById("expand-all").addEventListener("click", function () {
        window.ContentView.expandAll(document.getElementById("file-content"));
    });

    initViewSwitch();
});
