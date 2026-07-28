import { state } from "./app-state.js";

/** Filled by data/index.js to avoid cycles with navigation.js. */
let actions = {
    createStructuredFile: async function () { return null; },
    refreshTree: async function () {},
    selectFile: async function () {},
    selectNewEntry: async function () {},
};

export function installFileTreeActions(deps) {
    Object.assign(actions, deps);
}

export function displayName(name) {
    return name.replace(/\.json$/i, "");
}

export function setExpanded(li, toggle, name, expanded) {
    li.classList.toggle("tree-node--expanded", expanded);
    window.AppIcons.setLabel(toggle, expanded ? "folder-open" : "folder", name);
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
        const data = await actions.createStructuredFile(addStructuredFileButton, node.path);
        if (data) await actions.refreshTree();
    });

    const actionsEl = document.createElement("div");
    actionsEl.className = "tree-node__actions";
    actionsEl.appendChild(addFileButton);
    actionsEl.appendChild(addFolderButton);
    actionsEl.appendChild(addStructuredFileButton);

    header.appendChild(toggle);
    header.appendChild(actionsEl);
    attachDropTarget(li, node.path);

    li.appendChild(header);
    li.appendChild(childList);
    return li;
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
        actions.selectFile(node.path, button, { push: true });
    });
    attachDragSource(button, node.path);

    li.appendChild(button);
    return li;
}

export function renderTree(container, nodes) {
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

export function showToast(message) {
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

export async function moveEntry(sourcePath, targetDir) {
    if (!sourcePath) return;
    const response = await fetch("/api/data-tree/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: sourcePath, targetDir: targetDir }),
    });
    if (response.ok) {
        await actions.refreshTree();
    } else if (response.status === 409) {
        showToast(`"${displayName(sourcePath.split("/").pop())}" already exists there`);
    }
}

export function startCreateEntry(dirPath, childList, type) {
    const li = document.createElement("li");
    li.className = "tree-node tree-node--new";
    const input = document.createElement("input");
    input.type = "text";
    input.className = "tree-node__input";
    input.placeholder = type === "dir" ? "folder name" : "name";
    li.appendChild(input);

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
            await actions.selectNewEntry(result);
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

export function findButton(path) {
    return state.fileTreeRoot.querySelector(`.tree-node__label[data-path="${CSS.escape(path)}"]`);
}

export function expandAncestors(el) {
    let dirLi = el.closest(".tree-list").closest(".tree-node--dir");
    while (dirLi) {
        const toggle = dirLi.querySelector(":scope > .tree-node__header > .tree-node__toggle");
        setExpanded(dirLi, toggle, dirLi.dataset.name, true);
        dirLi = dirLi.parentElement.closest(".tree-node--dir");
    }
}

export function expandDirAndAncestors(dirLi) {
    const toggle = dirLi.querySelector(":scope > .tree-node__header > .tree-node__toggle");
    setExpanded(dirLi, toggle, dirLi.dataset.name, true);
    expandAncestors(toggle);
}

export function initFileTreeRootDrop() {
    const root = state.fileTreeRoot;
    root.addEventListener("dragover", function (event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        root.classList.add("tree-list--drop-target");
    });
    root.addEventListener("dragleave", function (event) {
        if (!root.contains(event.relatedTarget)) {
            root.classList.remove("tree-list--drop-target");
        }
    });
    root.addEventListener("drop", async function (event) {
        event.preventDefault();
        root.classList.remove("tree-list--drop-target");
        const sourcePath = event.dataTransfer.getData("text/plain");
        await moveEntry(sourcePath, "");
    });
}
