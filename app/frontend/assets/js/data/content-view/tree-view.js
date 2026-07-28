import {
    formatReadableValue,
    getMetadataDescription,
    hasItemsContract,
    isCollapsible,
    isPlainObject,
    isSchemaPath,
    summarizeCollapsed,
} from "./helpers.js";
import { createFillAllButton, createFillButton, isFillableItemPath } from "./magic-fill.js";

/** Tree <li>; collapse class matches JSON-view contract. */
export function buildTreeNode(key, value, path) {
    path = path || [];
    const li = document.createElement("li");
    li.className = "content-tree-node";
    if (isSchemaPath(path)) li.classList.add("content-tree-node--schema");

    const line = document.createElement("div");
    line.className = "content-tree-node__line";
    li.appendChild(line);

    if (isCollapsible(value)) {
        li.classList.add("content-tree-node--collapsible");

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "content-tree-node__toggle";
        toggle.setAttribute("aria-expanded", "true");
        toggle.innerHTML = window.AppIcons.markup("chevron-down");
        line.appendChild(toggle);

        if (key !== null) {
            const keyLabel = document.createElement("span");
            keyLabel.className = "content-tree-node__key";
            keyLabel.textContent = key;
            line.appendChild(keyLabel);
        }

        const summary = document.createElement("span");
        summary.className = "content-tree-node__summary";
        summary.textContent = summarizeCollapsed(value);
        summary.hidden = true;
        line.appendChild(summary);

        if (isFillableItemPath(path, value)) {
            line.appendChild(createFillButton(path[1]));
        }

        const childList = document.createElement("ul");
        childList.className = "content-tree-node__children";

        const isArray = Array.isArray(value);
        const entries = isArray
            ? value.map(function (v, i) { return [i, v]; })
            : Object.entries(value);

        entries.forEach(function ([childKey, childValue]) {
            childList.appendChild(buildTreeNode(childKey, childValue, path.concat([childKey])));
        });

        li.appendChild(childList);

        toggle.addEventListener("click", function () {
            setTreeNodeExpanded(li, li.classList.contains("content-tree-node--collapsed"));
        });

        if (isSchemaPath(path)) setTreeNodeExpanded(li, false);

        return li;
    }

    if (key !== null) {
        const keyLabel = document.createElement("span");
        keyLabel.className = "content-tree-node__key";
        keyLabel.textContent = key;
        line.appendChild(keyLabel);
    }

    const valueSpan = document.createElement("span");
    valueSpan.className = `content-tree-node__value content-tree-node__value--${typeof value === "object" ? "null" : typeof value}`;
    valueSpan.textContent = formatReadableValue(value);
    line.appendChild(valueSpan);

    return li;
}

function setTreeNodeExpanded(li, expanded) {
    li.classList.toggle("content-tree-node--collapsed", !expanded);
    const toggle = li.querySelector(":scope > .content-tree-node__line > .content-tree-node__toggle");
    const summary = li.querySelector(":scope > .content-tree-node__line > .content-tree-node__summary");
    if (toggle) {
        toggle.innerHTML = window.AppIcons.markup(expanded ? "chevron-down" : "chevron-right");
        toggle.setAttribute("aria-expanded", String(expanded));
    }
    if (summary) summary.hidden = expanded;
}

export function renderTree(parsedJson, container) {
    container.innerHTML = "";
    container.classList.remove("json-view");
    container.classList.add("tree-view");

    const visibleJson = isPlainObject(parsedJson)
        ? Object.fromEntries(Object.entries(parsedJson).filter(function ([key]) { return key !== "schema" && key !== "metadata"; }))
        : parsedJson;
    const rootList = document.createElement("ul");
    rootList.className = "content-tree-node__children content-tree-node__children--root";
    const root = buildTreeNode(null, visibleJson, []);
    if (hasItemsContract(parsedJson)) {
        const rootLine = root.querySelector(":scope > .content-tree-node__line");
        if (rootLine) rootLine.appendChild(createFillAllButton());
    }
    const description = getMetadataDescription(parsedJson);
    if (description !== null) {
        const childList = root.querySelector(":scope > .content-tree-node__children");
        if (childList) {
            childList.insertBefore(
                buildTreeNode("description", description, ["description"]),
                childList.firstChild
            );
        }
    }
    rootList.appendChild(root);
    container.appendChild(rootList);
}

export function collapseAllTree(container) {
    container.querySelectorAll(".content-tree-node--collapsible").forEach(function (li) {
        setTreeNodeExpanded(li, false);
    });
}

export function expandAllTree(container) {
    container.querySelectorAll(".content-tree-node--collapsible").forEach(function (li) {
        setTreeNodeExpanded(li, true);
    });
}
