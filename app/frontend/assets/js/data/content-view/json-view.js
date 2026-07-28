import {
    hasItemsContract,
    isCollapsible,
    isSchemaPath,
    isVersionsPath,
    summarizeCollapsed,
} from "./helpers.js";
import { createFillAllButton, createFillButton, isFillableItemPath } from "./magic-fill.js";

export function buildJsonNode(key, value, path) {
    path = path || [];
    const row = document.createElement("div");
    row.className = "json-node";
    if (isSchemaPath(path)) row.classList.add("json-node--schema");

    if (isCollapsible(value)) {
        row.classList.add("json-node--collapsible");

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "json-node__toggle";
        toggle.setAttribute("aria-expanded", "true");
        toggle.innerHTML = window.AppIcons.markup("chevron-down");

        const keyLabel = document.createElement("span");
        keyLabel.className = "json-node__key";
        if (key !== null) keyLabel.textContent = `${key}: `;

        const isArray = Array.isArray(value);
        const openBracket = document.createElement("span");
        openBracket.className = "json-node__bracket";
        openBracket.textContent = isArray ? "[" : "{";

        const closeBracket = document.createElement("span");
        closeBracket.className = "json-node__bracket";
        closeBracket.textContent = isArray ? "]" : "}";

        const summary = document.createElement("span");
        summary.className = "json-node__summary";
        summary.textContent = summarizeCollapsed(value);
        summary.hidden = true;

        const children = document.createElement("div");
        children.className = "json-node__children";

        const entries = isArray
            ? value.map(function (v, i) { return [i, v]; })
            : Object.entries(value);

        entries.forEach(function ([childKey, childValue]) {
            children.appendChild(buildJsonNode(childKey, childValue, path.concat([childKey])));
        });

        const header = document.createElement("div");
        header.className = "json-node__header";
        header.appendChild(toggle);
        if (key !== null) header.appendChild(keyLabel);
        header.appendChild(openBracket);
        header.appendChild(summary);
        if (isFillableItemPath(path, value)) {
            header.appendChild(createFillButton(path[1]));
        }

        row.appendChild(header);
        row.appendChild(children);
        row.appendChild(closeBracket);

        toggle.addEventListener("click", function () {
            setNodeExpanded(row, !row.classList.contains("json-node--collapsed") ? false : true);
        });

        if (isSchemaPath(path) || isVersionsPath(path)) setNodeExpanded(row, false);

        return row;
    }

    const line = document.createElement("div");
    line.className = "json-node__line";

    if (key !== null) {
        const keyLabel = document.createElement("span");
        keyLabel.className = "json-node__key";
        keyLabel.textContent = `${key}: `;
        line.appendChild(keyLabel);
    }

    const valueSpan = document.createElement("span");
    valueSpan.className = `json-node__value json-node__value--${typeof value === "object" ? "null" : typeof value}`;
    valueSpan.textContent = JSON.stringify(value);
    line.appendChild(valueSpan);

    row.appendChild(line);
    return row;
}

function setNodeExpanded(row, expanded) {
    row.classList.toggle("json-node--collapsed", !expanded);
    const toggle = row.querySelector(":scope > .json-node__header > .json-node__toggle");
    const summary = row.querySelector(":scope > .json-node__header > .json-node__summary");
    if (toggle) {
        toggle.innerHTML = window.AppIcons.markup(expanded ? "chevron-down" : "chevron-right");
        toggle.setAttribute("aria-expanded", String(expanded));
    }
    if (summary) summary.hidden = expanded;
}

export function renderJsonTree(parsedJson, container) {
    container.innerHTML = "";
    container.classList.remove("tree-view");
    container.classList.add("json-view");
    const root = buildJsonNode(null, parsedJson, []);
    if (hasItemsContract(parsedJson)) {
        const rootHeader = root.querySelector(":scope > .json-node__header");
        if (rootHeader) rootHeader.appendChild(createFillAllButton());
    }
    container.appendChild(root);
}

export function collapseAllJson(container) {
    container.querySelectorAll(".json-node--collapsible").forEach(function (row) {
        setNodeExpanded(row, false);
    });
}

export function expandAllJson(container) {
    container.querySelectorAll(".json-node--collapsible").forEach(function (row) {
        setNodeExpanded(row, true);
    });
}
