/** Content views for #file-content: facade over view/export modules. */
import { formatHistoryInstant, summarizeDocumentHistory } from "./document-history.js";
import { toDelimited, toMarkdownTable } from "./export.js";
import { isPlainObject, parseJsonSafe } from "./helpers.js";
import {
    buildJsonNode,
    collapseAllJson,
    expandAllJson,
    renderJsonTree,
} from "./json-view.js";
import { boolSum, renderTable } from "./table-view.js";
import { renderPlainText, renderText } from "./text-view.js";
import {
    buildTreeNode,
    collapseAllTree,
    expandAllTree,
    renderTree,
} from "./tree-view.js";

const views = {
    json: {
        render: function (parsedJson, rawText, container) {
            if (parsedJson === undefined) {
                renderPlainText(rawText, container);
                return;
            }
            renderJsonTree(parsedJson, container);
        },
        collapseAll: collapseAllJson,
        expandAll: expandAllJson,
    },

    tree: {
        render: function (parsedJson, rawText, container) {
            if (parsedJson === undefined) {
                renderPlainText(rawText, container);
                return;
            }
            renderTree(parsedJson, container);
        },
        collapseAll: collapseAllTree,
        expandAll: expandAllTree,
    },

    table: {
        render: function (parsedJson, rawText, container) {
            if (parsedJson === undefined) {
                renderPlainText(rawText, container);
                return;
            }
            renderTable(parsedJson, container);
        },
    },

    text: {
        render: function (parsedJson, rawText, container) {
            if (parsedJson === undefined) {
                renderPlainText(rawText, container);
                return;
            }
            renderText(parsedJson, container);
        },
    },
};

function render(viewName, rawText, container) {
    const view = views[viewName] || views.text;
    const parsedJson = parseJsonSafe(rawText);
    container.dataset.currentView = viewName;
    view.render(parsedJson, rawText, container);
}

function renderStructure(rawText, viewName, container) {
    const parsedJson = parseJsonSafe(rawText);
    container.innerHTML = "";
    container.classList.remove("json-view", "tree-view");

    if (!isPlainObject(parsedJson) || !Object.prototype.hasOwnProperty.call(parsedJson, "schema")) {
        container.className = "data-structure-popup__content data-structure-popup__empty";
        container.textContent = "No data structure";
        return;
    }

    container.className = "data-structure-popup__content";
    if (viewName === "json") {
        container.classList.add("json-view");
        container.appendChild(buildJsonNode(null, parsedJson.schema, []));
        return;
    }

    container.classList.add("tree-view");
    const rootList = document.createElement("ul");
    rootList.className = "content-tree-node__children content-tree-node__children--root";
    rootList.appendChild(buildTreeNode(null, parsedJson.schema, []));
    container.appendChild(rootList);
}

function collapseAll(container) {
    const viewName = container.dataset.currentView;
    const view = views[viewName];
    if (view && typeof view.collapseAll === "function") view.collapseAll(container);
}

function expandAll(container) {
    const viewName = container.dataset.currentView;
    const view = views[viewName];
    if (view && typeof view.expandAll === "function") view.expandAll(container);
}

window.ContentView = {
    render: render,
    collapseAll: collapseAll,
    expandAll: expandAll,
    renderStructure: renderStructure,
    toDelimited: toDelimited,
    toMarkdownTable: toMarkdownTable,
    boolSum: boolSum,
    summarizeDocumentHistory: summarizeDocumentHistory,
    formatHistoryInstant: formatHistoryInstant,
};
