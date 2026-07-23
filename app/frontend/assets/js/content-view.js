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

    // ------------------------------------------------------------------
    // Per-item "fill missing values" magic button
    // ------------------------------------------------------------------

    /**
     * True when `value` is a plain (non-array) object, i.e. a real record
     * object that can host a fill button.
     */
    function isPlainObject(value) {
        return value !== null && typeof value === "object" && !Array.isArray(value);
    }

    /**
     * True when the parsed document follows the project data contract:
     * a root object `{ schema, items }` whose `items` is an array. Only then
     * do per-item fill buttons make sense.
     */
    function hasItemsContract(parsedJson) {
        return isPlainObject(parsedJson) && Array.isArray(parsedJson.items);
    }

    function onFillClick(event, index, btn) {
        event.stopPropagation();               // must not toggle collapse/selection
        const ctx = window.MagicData.currentContext();
        window.magicLlm.runScenario("fill-item", {
            context: Object.assign({}, ctx, { item: { index: index } }),
            button: btn
        }).then(function (data) { if (data) window.MagicData.reloadDocument(); });
    }

    /**
     * Builds a sparkles fill button wired to onFillClick for the item at the given
     * 0-based original index in the top-level `items` array.
     */
    function createFillButton(index) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "magic-inline-btn";
        btn.setAttribute("aria-label", "Fill missing values");
        btn.dataset.tooltip = "Fill missing values";
        btn.innerHTML = window.AppIcons.markup("sparkles");
        btn.addEventListener("click", function (event) {
            onFillClick(event, index, btn);
        });
        return btn;
    }

    function createFillAllButton() {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "magic-inline-btn magic-fill-all-btn";
        btn.setAttribute("aria-label", "Fill all");
        btn.dataset.tooltip = "Fill all";
        btn.innerHTML = window.AppIcons.markup("sparkles");
        btn.addEventListener("click", function (event) {
            event.stopPropagation();
            window.magicLlm.runScenario("fill-all", {
                context: window.MagicData.currentContext(),
                button: btn
            }).then(function (data) { if (data) window.MagicData.reloadDocument(); });
        });
        return btn;
    }

    function onFillColumnClick(event, key, btn) {
        event.stopPropagation();               // must not trigger the header sort
        const ctx = window.MagicData.currentContext();
        window.magicLlm.runScenario("fill-column", {
            context: Object.assign({}, ctx, { column: { key: key } }),
            button: btn
        }).then(function (data) { if (data) window.MagicData.reloadDocument(); });
    }

    /**
     * Builds a sparkles fill button that fills the missing values of a single column
     * (the `key` field) across every item. Lives in the Table column header,
     * next to the row-fill buttons, so it must not trigger header sorting.
     */
    function createColumnFillButton(key) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "magic-inline-btn content-table__col-fill";
        btn.setAttribute("aria-label", "Fill this column");
        btn.dataset.tooltip = "Fill this column";
        btn.innerHTML = window.AppIcons.markup("sparkles");
        btn.addEventListener("click", function (event) {
            onFillColumnClick(event, key, btn);
        });
        // Keep keyboard activation on the button from bubbling to the th's
        // Enter/Space sort handler.
        btn.addEventListener("keydown", function (event) {
            if (event.key === "Enter" || event.key === " ") event.stopPropagation();
        });
        return btn;
    }

    /**
     * True when a node reached at `path` (array of keys/indices from the root)
     * with the given `value` is a fillable top-level item: exactly
     * `items[<number>]` and a plain object.
     */
    function isFillableItemPath(path, value) {
        return path.length === 2 && path[0] === "items" &&
            typeof path[1] === "number" && isPlainObject(value);
    }

    /**
     * True when a node reached at `path` is the top-level `schema` node of the
     * project data contract (`{ schema, items }`). The schema is technical
     * metadata, not primary content, so views de-emphasize it (muted, and
     * collapsed by default where collapsing exists).
     */
    function isSchemaPath(path) {
        return path.length === 1 && path[0] === "schema";
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
    function buildJsonNode(key, value, path) {
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

            if (isSchemaPath(path)) setNodeExpanded(row, false);

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
            toggle.innerHTML = window.AppIcons.markup(expanded ? "chevron-down" : "chevron-right");
            toggle.setAttribute("aria-expanded", String(expanded));
        }
        if (summary) summary.hidden = expanded;
    }

    function renderJsonTree(parsedJson, container) {
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
    function buildTreeNode(key, value, path) {
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
            toggle.innerHTML = window.AppIcons.markup(expanded ? "chevron-down" : "chevron-right");
            toggle.setAttribute("aria-expanded", String(expanded));
        }
        if (summary) summary.hidden = expanded;
    }

    function renderTree(parsedJson, container) {
        container.innerHTML = "";
        container.classList.remove("json-view");
        container.classList.add("tree-view");

        const visibleJson = isPlainObject(parsedJson)
            ? Object.fromEntries(Object.entries(parsedJson).filter(function ([key]) { return key !== "schema"; }))
            : parsedJson;
        const rootList = document.createElement("ul");
        rootList.className = "content-tree-node__children content-tree-node__children--root";
        const root = buildTreeNode(null, visibleJson, []);
        if (hasItemsContract(parsedJson)) {
            const rootLine = root.querySelector(":scope > .content-tree-node__line");
            if (rootLine) rootLine.appendChild(createFillAllButton());
        }
        rootList.appendChild(root);
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

        // Fill buttons only make sense for the real data contract
        // (`{ schema, items }`). Capture each row object's ORIGINAL index
        // before sorting reorders the display; sorting reuses the same object
        // references, so rowIndex.get(rowObj) stays correct after a sort.
        const hasItems = hasItemsContract(parsedJson);
        const rowIndex = new Map(rowObjects.map(function (o, i) { return [o, i]; }));

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
        if (hasItems) {
            const fillHeader = document.createElement("th");
            fillHeader.className = "content-table__header-cell";
            fillHeader.appendChild(createFillAllButton());
            headerRow.appendChild(fillHeader);
        }
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

            if (hasItems) th.appendChild(createColumnFillButton(col));

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
                if (hasItems) {
                    const fillCell = document.createElement("td");
                    fillCell.className = "content-table__cell";
                    fillCell.appendChild(createFillButton(rowIndex.get(rowObj)));
                    tr.appendChild(fillCell);
                }
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
                // Active column shows its real direction; every other column
                // shows a faint two-way chevron hinting that it is sortable.
                cell.indicator.classList.toggle("content-table__sort-indicator--hint", !active);
                cell.indicator.innerHTML = window.AppIcons.markup(
                    active ? (sortState.dir === "asc" ? "chevron-up" : "chevron-down") : "chevrons-up-down",
                    "icon--sm"
                );
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

        if (hasItemsContract(parsedJson)) {
            const actions = document.createElement("div");
            actions.className = "content-text__actions";
            actions.appendChild(createFillAllButton());
            container.appendChild(actions);
        }

        if (isCollapsible(parsedJson)) {
            if (Array.isArray(parsedJson)) {
                renderTextNode(null, parsedJson, container, 1);
            } else {
                Object.entries(parsedJson).forEach(function ([childKey, childValue]) {
                    if (!isSchemaPath([childKey])) renderTextNode(childKey, childValue, container, 1);
                });
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
    };
})();
