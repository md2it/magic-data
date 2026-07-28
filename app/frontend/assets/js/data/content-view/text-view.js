import {
    formatReadableValue,
    getDocumentDisplayName,
    getMetadataDescription,
    hasItemsContract,
    isCollapsible,
    isMetadataPath,
    isSchemaPath,
} from "./helpers.js";
import { createFillAllButton, createFillButton, isFillableItemPath } from "./magic-fill.js";

export function renderPlainText(rawText, container) {
    container.innerHTML = "";
    container.classList.remove("json-view", "tree-view");
    container.textContent = rawText;
}

const MAX_HEADING_LEVEL = 6;

function headingLevelClass(level) {
    return `content-text__heading--level-${Math.min(level, 99)}`;
}

function appendHeading(container, text, level, fillIndex) {
    const tag = "h" + Math.min(level, MAX_HEADING_LEVEL);
    const heading = document.createElement(tag);
    heading.className = `content-text__heading ${headingLevelClass(level)}`;
    heading.textContent = text;
    if (typeof fillIndex === "number") {
        heading.classList.add("content-text__heading--with-fill");
        heading.appendChild(createFillButton(fillIndex));
    }
    container.appendChild(heading);
}

function appendParagraph(container, value) {
    const p = document.createElement("p");
    p.className = "content-text__value";
    if (value === null) p.classList.add("content-text__value--null");
    p.textContent = formatReadableValue(value);
    container.appendChild(p);
}

/** Prose render; arrays of objects get "Item N" headings. */
function renderTextNode(key, value, container, level, path) {
    if (isCollapsible(value)) {
        if (key !== null) {
            appendHeading(container, String(key), level);
        }

        if (Array.isArray(value)) {
            const allPrimitive = value.every(function (v) { return !isCollapsible(v); });
            if (allPrimitive) {
                const list = document.createElement("ul");
                list.className = "content-text__list";
                value.forEach(function (item) {
                    const li = document.createElement("li");
                    li.className = "content-text__list-item";
                    if (item === null) li.classList.add("content-text__list-item--null");
                    li.textContent = formatReadableValue(item);
                    list.appendChild(li);
                });
                container.appendChild(list);
            } else {
                const itemLevel = key !== null ? level + 1 : level;
                value.forEach(function (item, index) {
                    const childPath = path.concat([index]);
                    if (isCollapsible(item)) {
                        const fillIndex = isFillableItemPath(childPath, item)
                            ? index
                            : undefined;
                        appendHeading(container, `Item ${index + 1}`, itemLevel, fillIndex);
                        renderObjectChildren(item, container, itemLevel + 1, childPath);
                    } else {
                        appendParagraph(container, item);
                    }
                });
            }
        } else {
            renderObjectChildren(value, container, key !== null ? level + 1 : level, path);
        }
        return;
    }

    if (key !== null) {
        const p = document.createElement("p");
        p.className = "content-text__value content-text__value--labeled";
        const label = document.createElement("span");
        label.className = "content-text__label";
        label.textContent = `${key}: `;
        p.appendChild(label);
        const valueNode = document.createElement("span");
        if (value === null) valueNode.className = "content-text__value--null";
        valueNode.textContent = formatReadableValue(value);
        p.appendChild(valueNode);
        container.appendChild(p);
    } else {
        appendParagraph(container, value);
    }
}

function renderObjectChildren(obj, container, level, path) {
    Object.entries(obj).forEach(function ([childKey, childValue]) {
        renderTextNode(childKey, childValue, container, level, path.concat([childKey]));
    });
}

export function renderText(parsedJson, container) {
    container.innerHTML = "";
    container.classList.remove("json-view", "tree-view", "content-table-view");
    container.classList.add("content-text-view");

    if (hasItemsContract(parsedJson)) {
        const actions = document.createElement("div");
        actions.className = "content-text__actions";
        actions.appendChild(createFillAllButton());
        container.appendChild(actions);
    }

    if (isCollapsible(parsedJson)) {
        if (Array.isArray(parsedJson)) {
            renderTextNode(null, parsedJson, container, 1, []);
        } else {
            const description = getMetadataDescription(parsedJson);
            Object.entries(parsedJson).forEach(function ([childKey, childValue]) {
                if (isSchemaPath([childKey]) || isMetadataPath([childKey])) return;
                if (childKey === "items") {
                    appendHeading(container, getDocumentDisplayName() || "items", 1);
                    if (description !== null) appendParagraph(container, description);
                    renderTextNode(null, childValue, container, 2, ["items"]);
                } else {
                    renderTextNode(childKey, childValue, container, 1, [childKey]);
                }
            });
        }
    } else {
        appendParagraph(container, parsedJson);
    }
}
