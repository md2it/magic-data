/**
 * content-view.js
 *
 * Owns everything related to rendering the *content* of a selected file
 * (the right-hand pane, #file-content) in one of the view modes exposed by
 * the #view-switch toolbar: json | tree | table | text.
 *
 * Also owns the global "Collapse all" / "Expand all" toolbar buttons as they
 * apply to the currently rendered content (NOT the left-hand file tree,
 * which is owned by index.js).
 *
 * Public API (window.ContentView):
 *   - render(viewName, rawText, container)
 *       Renders `rawText` (the raw text content of the selected file) into
 *       `container` (a DOM element, typically #file-content) using the
 *       requested view. Returns nothing; mutates `container` in place.
 *       `viewName` is one of "json" | "tree" | "table" | "text".
 *
 *   - collapseAll(container)
 *       Collapses every collapsible node currently rendered in `container`.
 *       No-op if the current view has nothing collapsible.
 *
 *   - expandAll(container)
 *       Expands every collapsible node currently rendered in `container`.
 *       No-op if the current view has nothing collapsible.
 *
 *   - toDelimited(rawText, delimiter)
 *       Converts `rawText` (raw file content) to a delimited-text string
 *       (e.g. "," for CSV, "\t" for TSV) using the same row/column
 *       extraction and cell formatting as the Table view, so downloads
 *       match what is rendered on screen.
 *
 * Extending with a new view (tree/table/text):
 *   Each view is implemented as an entry in the `views` object below, with
 *   the shape:
 *     {
 *       render(parsedJson, rawText, container) -> void,
 *       collapseAll(container) -> void,   // optional
 *       expandAll(container) -> void,     // optional
 *     }
 *   `render.json` under `views` is the reference implementation. Add
 *   `views.tree`, `views.table`, `views.text` following the same shape.
 *   `render()` below already parses JSON once and falls back to plain text
 *   automatically, so individual view implementations can generally assume
 *   they receive valid parsed JSON (`parsedJson`) except for the "text"
 *   view and the graceful-fallback path.
 */
(function () {
    "use strict";

    // ------------------------------------------------------------------
    // Shared helpers
    // ------------------------------------------------------------------

    function isCollapsible(value) {
        return value !== null && (Array.isArray(value) || typeof value === "object");
    }

    function summarizeCollapsed(value) {
        if (Array.isArray(value)) {
            return `[...] ${value.length} item${value.length === 1 ? "" : "s"}`;
        }
        const keys = Object.keys(value);
        return `{...} ${keys.length} key${keys.length === 1 ? "" : "s"}`;
    }

    /**
     * Builds a DOM node representing `value`, optionally preceded by a key
     * label (for object properties). Collapsible values (objects/arrays)
     * get a toggle button.
     */
    function buildJsonNode(key, value) {
        const row = document.createElement("div");
        row.className = "json-node";

        if (isCollapsible(value)) {
            row.classList.add("json-node--collapsible");

            const toggle = document.createElement("button");
            toggle.type = "button";
            toggle.className = "json-node__toggle";
            toggle.setAttribute("aria-expanded", "true");
            toggle.textContent = "▾";

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
                children.appendChild(buildJsonNode(childKey, childValue));
            });

            const header = document.createElement("div");
            header.className = "json-node__header";
            header.appendChild(toggle);
            if (key !== null) header.appendChild(keyLabel);
            header.appendChild(openBracket);
            header.appendChild(summary);

            row.appendChild(header);
            row.appendChild(children);
            row.appendChild(closeBracket);

            toggle.addEventListener("click", function () {
                setNodeExpanded(row, !row.classList.contains("json-node--collapsed") ? false : true);
            });

            return row;
        }

        // Primitive value (string, number, boolean, null)
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
            toggle.textContent = expanded ? "▾" : "▸";
            toggle.setAttribute("aria-expanded", String(expanded));
        }
        if (summary) summary.hidden = expanded;
    }

    function renderJsonTree(parsedJson, container) {
        container.innerHTML = "";
        container.classList.remove("tree-view");
        container.classList.add("json-view");
        const root = buildJsonNode(null, parsedJson);
        container.appendChild(root);
    }

    function collapseAllJson(container) {
        container.querySelectorAll(".json-node--collapsible").forEach(function (row) {
            setNodeExpanded(row, false);
        });
    }

    function expandAllJson(container) {
        container.querySelectorAll(".json-node--collapsible").forEach(function (row) {
            setNodeExpanded(row, true);
        });
    }

    function renderPlainText(rawText, container) {
        container.innerHTML = "";
        container.classList.remove("json-view", "tree-view");
        container.textContent = rawText;
    }

    // ------------------------------------------------------------------
    // Tree view (multi-level list rendering of the same JSON data)
    // ------------------------------------------------------------------

    /**
     * Builds a <li> representing `value`, optionally labelled with `key`
     * (object property name or array index). Collapsible values get a
     * toggle control and a nested <ul> of children, following the same
     * per-node collapse contract as the JSON view (a
     * "content-tree-node--collapsed" class hides the child list and flips the
     * toggle glyph/summary).
     */
    function buildTreeNode(key, value) {
        const li = document.createElement("li");
        li.className = "content-tree-node";

        const line = document.createElement("div");
        line.className = "content-tree-node__line";
        li.appendChild(line);

        if (isCollapsible(value)) {
            li.classList.add("content-tree-node--collapsible");

            const toggle = document.createElement("button");
            toggle.type = "button";
            toggle.className = "content-tree-node__toggle";
            toggle.setAttribute("aria-expanded", "true");
            toggle.textContent = "▾";
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

            const childList = document.createElement("ul");
            childList.className = "content-tree-node__children";

            const isArray = Array.isArray(value);
            const entries = isArray
                ? value.map(function (v, i) { return [i, v]; })
                : Object.entries(value);

            entries.forEach(function ([childKey, childValue]) {
                childList.appendChild(buildTreeNode(childKey, childValue));
            });

            li.appendChild(childList);

            toggle.addEventListener("click", function () {
                setTreeNodeExpanded(li, li.classList.contains("content-tree-node--collapsed"));
            });

            return li;
        }

        // Leaf value (string, number, boolean, null)
        if (key !== null) {
            const keyLabel = document.createElement("span");
            keyLabel.className = "content-tree-node__key";
            keyLabel.textContent = key;
            line.appendChild(keyLabel);
        }

        const valueSpan = document.createElement("span");
        valueSpan.className = `content-tree-node__value content-tree-node__value--${typeof value === "object" ? "null" : typeof value}`;
        valueSpan.textContent = JSON.stringify(value);
        line.appendChild(valueSpan);

        return li;
    }

    function setTreeNodeExpanded(li, expanded) {
        li.classList.toggle("content-tree-node--collapsed", !expanded);
        const toggle = li.querySelector(":scope > .content-tree-node__line > .content-tree-node__toggle");
        const summary = li.querySelector(":scope > .content-tree-node__line > .content-tree-node__summary");
        if (toggle) {
            toggle.textContent = expanded ? "▾" : "▸";
            toggle.setAttribute("aria-expanded", String(expanded));
        }
        if (summary) summary.hidden = expanded;
    }

    function renderTree(parsedJson, container) {
        container.innerHTML = "";
        container.classList.remove("json-view");
        container.classList.add("tree-view");

        const rootList = document.createElement("ul");
        rootList.className = "content-tree-node__children content-tree-node__children--root";
        rootList.appendChild(buildTreeNode(null, parsedJson));
        container.appendChild(rootList);
    }

    function collapseAllTree(container) {
        container.querySelectorAll(".content-tree-node--collapsible").forEach(function (li) {
            setTreeNodeExpanded(li, false);
        });
    }

    function expandAllTree(container) {
        container.querySelectorAll(".content-tree-node--collapsible").forEach(function (li) {
            setTreeNodeExpanded(li, true);
        });
    }

    // ------------------------------------------------------------------
    // Table view (flattens top-level nodes into rows/columns)
    // ------------------------------------------------------------------

    /**
     * Formats a cell value for display:
     *  - undefined -> "" (row simply has no value for that column)
     *  - primitives -> their plain representation (strings unquoted)
     *  - objects/arrays (2nd level and deeper) -> compact JSON text
     */
    function formatCellValue(value) {
        if (value === undefined) return "";
        if (value === null) return "null";
        if (typeof value === "object") return JSON.stringify(value);
        return String(value);
    }

    /**
     * Given the array of top-level row-source objects (only the ones that are
     * plain objects), computes the ordered, de-duplicated list of column keys
     * following first-appearance order across all rows.
     */
    function collectColumns(rowObjects) {
        const seen = new Set();
        const columns = [];
        rowObjects.forEach(function (obj) {
            Object.keys(obj).forEach(function (key) {
                if (!seen.has(key)) {
                    seen.add(key);
                    columns.push(key);
                }
            });
        });
        return columns;
    }

    /**
     * Orders two *present* (non-empty) cell values for a single column:
     *  - two numbers compare numerically;
     *  - two booleans order false < true;
     *  - everything else (objects/arrays and mixed types) compares by its
     *    displayed string form, numeric-aware and case-insensitive.
     * Empty cells (undefined/null) are handled by the caller so they always
     * fall to the end regardless of sort direction.
     */
    function compareNonEmpty(a, b) {
        if (typeof a === "number" && typeof b === "number") return a - b;
        if (typeof a === "boolean" && typeof b === "boolean") return (a ? 1 : 0) - (b ? 1 : 0);
        const as = typeof a === "object" ? JSON.stringify(a) : String(a);
        const bs = typeof b === "object" ? JSON.stringify(b) : String(b);
        return as.localeCompare(bs, undefined, { numeric: true, sensitivity: "base" });
    }

    /**
     * Normalizes a top-level node into a plain object suitable for column
     * extraction. Real objects pass through as-is; anything else (primitive,
     * array, null) is wrapped into a single-column { value: ... } record so
     * rendering never breaks on mixed-shape top-level data.
     */
    function toRowObject(node) {
        if (node !== null && typeof node === "object" && !Array.isArray(node)) {
            return node;
        }
        return { value: node };
    }

    /**
     * Picks the collection of top-level nodes to turn into table rows.
     *
     * The primary shape this app serves is the project data contract:
     * a root object `{ schema, items }` where `items` is the array of record
     * objects (see data/AGENTS.md). When that shape is present we tabulate
     * `items` directly, so `schema` (metadata) is never mistaken for a row.
     *
     * Otherwise we degrade gracefully for arbitrary JSON:
     *   - an array root         -> its elements are the rows
     *   - any other object root  -> its values are the rows
     *   - a primitive root       -> null (nothing tabular; caller falls back)
     */
    function selectRowSource(parsedJson) {
        if (parsedJson !== null && typeof parsedJson === "object" && !Array.isArray(parsedJson)) {
            if (Array.isArray(parsedJson.items)) {
                return parsedJson.items;
            }
            return Object.values(parsedJson);
        }
        if (Array.isArray(parsedJson)) {
            return parsedJson;
        }
        return null;
    }

    function renderTable(parsedJson, container) {
        container.innerHTML = "";
        container.classList.remove("json-view", "tree-view");
        container.classList.add("content-table-view");

        const topLevelNodes = selectRowSource(parsedJson);
        if (topLevelNodes === null) {
            // Root is a primitive - nothing tabular to show, fall back to text.
            renderPlainText(JSON.stringify(parsedJson), container);
            return;
        }

        if (topLevelNodes.length === 0) {
            const empty = document.createElement("div");
            empty.className = "content-table__empty";
            empty.textContent = "(empty)";
            container.appendChild(empty);
            return;
        }

        const rowObjects = topLevelNodes.map(toRowObject);
        const columns = collectColumns(rowObjects);

        // View-local sort state. Default is no sort (rows in original JSON
        // order). Clicking a header sorts it ascending; clicking the same
        // header again flips to descending. Only one column is active at a
        // time. State resets whenever the table is re-rendered (file/view
        // switch), matching "no sort when the table first opens".
        const sortState = { column: null, dir: "asc" };

        const wrapper = document.createElement("div");
        wrapper.className = "content-table__wrapper";

        const table = document.createElement("table");
        table.className = "content-table";

        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");
        const headerCells = {};
        columns.forEach(function (col) {
            const th = document.createElement("th");
            th.className = "content-table__header-cell content-table__header-cell--sortable";
            th.setAttribute("role", "button");
            th.setAttribute("tabindex", "0");
            th.setAttribute("aria-sort", "none");

            const label = document.createElement("span");
            label.className = "content-table__header-label";
            label.textContent = col;
            th.appendChild(label);

            const indicator = document.createElement("span");
            indicator.className = "content-table__sort-indicator";
            indicator.setAttribute("aria-hidden", "true");
            th.appendChild(indicator);

            function toggleSort() {
                if (sortState.column === col) {
                    sortState.dir = sortState.dir === "asc" ? "desc" : "asc";
                } else {
                    sortState.column = col;
                    sortState.dir = "asc";
                }
                renderBody();
                updateHeaders();
            }

            th.addEventListener("click", toggleSort);
            th.addEventListener("keydown", function (event) {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    toggleSort();
                }
            });

            headerCells[col] = { th: th, indicator: indicator };
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        table.appendChild(tbody);

        function orderedRows() {
            if (sortState.column === null) return rowObjects;
            const column = sortState.column;
            const factor = sortState.dir === "desc" ? -1 : 1;
            // slice() keeps the original array intact; Array.sort is stable, so
            // equal/empty rows retain their original relative order.
            return rowObjects.slice().sort(function (rowA, rowB) {
                const a = rowA[column];
                const b = rowB[column];
                const aEmpty = a === undefined || a === null;
                const bEmpty = b === undefined || b === null;
                if (aEmpty || bEmpty) return aEmpty === bEmpty ? 0 : (aEmpty ? 1 : -1);
                return factor * compareNonEmpty(a, b);
            });
        }

        function renderBody() {
            tbody.innerHTML = "";
            orderedRows().forEach(function (rowObj) {
                const tr = document.createElement("tr");
                tr.className = "content-table__row";
                columns.forEach(function (col) {
                    const td = document.createElement("td");
                    td.className = "content-table__cell";
                    const value = rowObj[col];
                    if (value !== undefined && typeof value === "object") {
                        td.classList.add("content-table__cell--json");
                    }
                    td.textContent = formatCellValue(value);
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
        }

        function updateHeaders() {
            columns.forEach(function (col) {
                const cell = headerCells[col];
                const active = sortState.column === col;
                cell.th.classList.toggle("content-table__header-cell--sorted", active);
                cell.th.setAttribute(
                    "aria-sort",
                    active ? (sortState.dir === "asc" ? "ascending" : "descending") : "none"
                );
                cell.indicator.textContent = active ? (sortState.dir === "asc" ? "▲" : "▼") : "";
            });
        }

        renderBody();
        updateHeaders();

        wrapper.appendChild(table);
        container.appendChild(wrapper);
    }

    // ------------------------------------------------------------------
    // Text view (readable prose rendering: keys become headings, values
    // become plain text; all JSON punctuation is stripped)
    // ------------------------------------------------------------------

    const MAX_HEADING_LEVEL = 6;

    function headingLevelClass(level) {
        return `content-text__heading--level-${Math.min(level, 99)}`;
    }

    function appendHeading(container, text, level) {
        const tag = "h" + Math.min(level, MAX_HEADING_LEVEL);
        const heading = document.createElement(tag);
        heading.className = `content-text__heading ${headingLevelClass(level)}`;
        heading.textContent = text;
        container.appendChild(heading);
    }

    function appendParagraph(container, value) {
        const p = document.createElement("p");
        p.className = "content-text__value";
        p.textContent = value === null ? "null" : String(value);
        container.appendChild(p);
    }

    /**
     * Renders `value` into `container`.
     *  - `key` (string|number|null): the property key/array index leading to
     *    this value, or null at the root / for array elements (arrays have
     *    no keys of their own).
     *  - `level`: heading level to use if `key` turns out to head a block.
     *
     * Decision for arrays of objects: each object element does not have a
     * name of its own, so instead of inventing a heading for it we render
     * an "Item N" sub-heading at the next level down to visually separate
     * elements, then render the object's own keys as headings one level
     * deeper still. Arrays of primitives are rendered as a simple list
     * (one paragraph per item, no heading per item).
     */
    function renderTextNode(key, value, container, level) {
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
                        li.textContent = item === null ? "null" : String(item);
                        list.appendChild(li);
                    });
                    container.appendChild(list);
                } else {
                    const itemLevel = key !== null ? level + 1 : level;
                    value.forEach(function (item, index) {
                        if (isCollapsible(item)) {
                            appendHeading(container, `Item ${index + 1}`, itemLevel);
                            renderObjectChildren(item, container, itemLevel + 1);
                        } else {
                            appendParagraph(container, item);
                        }
                    });
                }
            } else {
                renderObjectChildren(value, container, key !== null ? level + 1 : level);
            }
            return;
        }

        // Primitive value: always plain text, never a heading. Render the
        // key (if any) as an inline label followed by the value.
        if (key !== null) {
            const p = document.createElement("p");
            p.className = "content-text__value content-text__value--labeled";
            const label = document.createElement("span");
            label.className = "content-text__label";
            label.textContent = `${key}: `;
            p.appendChild(label);
            p.appendChild(document.createTextNode(value === null ? "null" : String(value)));
            container.appendChild(p);
        } else {
            appendParagraph(container, value);
        }
    }

    function renderObjectChildren(obj, container, level) {
        Object.entries(obj).forEach(function ([childKey, childValue]) {
            renderTextNode(childKey, childValue, container, level);
        });
    }

    function renderText(parsedJson, container) {
        container.innerHTML = "";
        container.classList.remove("json-view", "tree-view", "content-table-view");
        container.classList.add("content-text-view");

        if (isCollapsible(parsedJson)) {
            if (Array.isArray(parsedJson)) {
                renderTextNode(null, parsedJson, container, 1);
            } else {
                renderObjectChildren(parsedJson, container, 1);
            }
        } else {
            appendParagraph(container, parsedJson);
        }
    }

    // ------------------------------------------------------------------
    // Delimited text export (CSV/TSV) - reuses the exact same row/column
    // extraction and cell formatting as the Table view, so the exported
    // file matches what is rendered on screen.
    // ------------------------------------------------------------------

    function needsQuoting(value, delimiter) {
        return value.indexOf(delimiter) !== -1 || value.indexOf('"') !== -1 ||
            value.indexOf("\n") !== -1 || value.indexOf("\r") !== -1;
    }

    function delimitedEscape(value, delimiter) {
        return needsQuoting(value, delimiter) ? `"${value.replace(/"/g, '""')}"` : value;
    }

    function toDelimited(rawText, delimiter) {
        const parsedJson = parseJsonSafe(rawText);
        if (parsedJson === undefined) return rawText;

        const topLevelNodes = selectRowSource(parsedJson);
        if (topLevelNodes === null) return delimitedEscape(formatCellValue(parsedJson), delimiter);
        if (topLevelNodes.length === 0) return "";

        const rowObjects = topLevelNodes.map(toRowObject);
        const columns = collectColumns(rowObjects);

        const lines = [columns.map(function (col) { return delimitedEscape(col, delimiter); }).join(delimiter)];
        rowObjects.forEach(function (rowObj) {
            lines.push(columns.map(function (col) {
                return delimitedEscape(formatCellValue(rowObj[col]), delimiter);
            }).join(delimiter));
        });
        return lines.join("\r\n");
    }

    // ------------------------------------------------------------------
    // View registry
    // ------------------------------------------------------------------

    const views = {
        json: {
            render: function (parsedJson, rawText, container) {
                if (parsedJson === undefined) {
                    // Not valid JSON -> graceful fallback to plain text.
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
                    // Not valid JSON -> graceful fallback to plain text.
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
                    // Not valid JSON -> graceful fallback to plain text.
                    renderPlainText(rawText, container);
                    return;
                }
                renderTable(parsedJson, container);
            },
            // No collapse/expand semantics for a flat table - both are no-ops
            // by omission, per the ContentView contract.
        },

        text: {
            render: function (parsedJson, rawText, container) {
                if (parsedJson === undefined) {
                    // Not valid JSON -> graceful fallback to plain text.
                    renderPlainText(rawText, container);
                    return;
                }
                renderText(parsedJson, container);
            },
            // No collapse/expand semantics for flat readable text - both are
            // no-ops by omission, per the ContentView contract.
        },
    };

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------

    function parseJsonSafe(rawText) {
        try {
            return JSON.parse(rawText);
        } catch (err) {
            return undefined;
        }
    }

    function render(viewName, rawText, container) {
        const view = views[viewName] || views.text;
        const parsedJson = parseJsonSafe(rawText);
        container.dataset.currentView = viewName;
        view.render(parsedJson, rawText, container);
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
        toDelimited: toDelimited,
    };
})();
