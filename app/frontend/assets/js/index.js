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

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "tree-node__toggle";
    toggle.textContent = `▸ ${node.name}`;

    const childList = document.createElement("ul");
    childList.className = "tree-list";
    renderTree(childList, node.children);

    toggle.addEventListener("click", function () {
        setExpanded(li, toggle, node.name, !li.classList.contains("tree-node--expanded"));
    });

    li.appendChild(toggle);
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
    button.addEventListener("click", function () {
        selectFile(node.path, button);
    });

    li.appendChild(button);
    return li;
}

function renderTree(container, nodes) {
    nodes.forEach(function (node) {
        container.appendChild(node.type === "dir" ? createDirNode(node) : createFileNode(node));
    });
}

async function selectFile(path, button) {
    document.querySelectorAll(".tree-node__label").forEach(function (btn) {
        btn.classList.toggle("active", btn === button);
    });

    const content = document.getElementById("file-content");
    content.textContent = await loadFileContent(path);
}

function expandAncestors(button) {
    let dirLi = button.closest(".tree-list").closest(".tree-node--dir");
    while (dirLi) {
        const toggle = dirLi.querySelector(":scope > .tree-node__toggle");
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

document.addEventListener("DOMContentLoaded", async function () {
    const tree = await loadFileTree();
    const root = document.getElementById("file-tree");
    renderTree(root, tree);

    const firstPath = findFirstFilePath(tree);
    if (firstPath) {
        const button = root.querySelector(`.tree-node__label[data-path="${CSS.escape(firstPath)}"]`);
        expandAncestors(button);
        button.click();
    }
});
