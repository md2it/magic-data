import {
    formatReadableValue,
    getMetadataDescription,
    hasItemsContract,
    isBoolSumEnabled,
} from "./helpers.js";
import {
    createColumnFillButton,
    createFillAllButton,
    createFillButton,
} from "./magic-fill.js";
import { closeCellOverlay, openCellOverlay } from "./table-cell-overlay.js";
import { renderPlainText } from "./text-view.js";

/** Cell display: undefined→""; objects→JSON; else readable. */
function formatCellValue(value) {
    if (value === undefined) return "";
    if (value === null) return "null";
    if (typeof value === "object") return JSON.stringify(value);
    return formatReadableValue(value);
}

function isNumericCellText(text) {
    return /^-?\d+(\.\d+)?$/.test(text);
}

export function formatExportCellValue(value) {
    if (value === undefined) return "";
    if (value === null) return "null";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
}

/** Column keys in first-appearance order. */
export function collectColumns(rowObjects) {
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

export function boolSum(rowObject) {
    return Object.values(rowObject).reduce(function (sum, value) {
        return sum + (value === true ? 1 : 0);
    }, 0);
}

function compareNonEmpty(a, b) {
    if (typeof a === "number" && typeof b === "number") return a - b;
    if (typeof a === "boolean" && typeof b === "boolean") return (a ? 1 : 0) - (b ? 1 : 0);
    const as = typeof a === "object" ? JSON.stringify(a) : String(a);
    const bs = typeof b === "object" ? JSON.stringify(b) : String(b);
    return as.localeCompare(bs, undefined, { numeric: true, sensitivity: "base" });
}

export function toRowObject(node) {
    if (node !== null && typeof node === "object" && !Array.isArray(node)) {
        return node;
    }
    return { value: node };
}

/** Rows from items[], else array elements / object values; null if primitive. */
export function selectRowSource(parsedJson) {
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

export function renderTable(parsedJson, container) {
    container.innerHTML = "";
    container.classList.remove("json-view", "tree-view");
    container.classList.add("content-table-view");

    const description = getMetadataDescription(parsedJson);
    if (description !== null) {
        const caption = document.createElement("p");
        caption.className = "content-table__description";
        caption.textContent = description;
        container.appendChild(caption);
    }

    const topLevelNodes = selectRowSource(parsedJson);
    if (topLevelNodes === null) {
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
    const showBoolSum = isBoolSumEnabled();

    const hasItems = hasItemsContract(parsedJson);
    const rowIndex = new Map(rowObjects.map(function (o, i) { return [o, i]; }));

    const sortState = { column: null, dir: "asc" };

    const layout = document.createElement("div");
    layout.className = "content-table__layout";

    const wrapper = document.createElement("div");
    wrapper.className = "content-table__wrapper";

    const table = document.createElement("table");
    table.className = "content-table";

    const colgroup = document.createElement("colgroup");
    let fillCol = null;
    let fillHeader = null;
    if (hasItems) {
        fillCol = document.createElement("col");
        fillCol.className = "content-table__col--fill";
        colgroup.appendChild(fillCol);
    }
    const dataCols = {};
    columns.forEach(function (col) {
        const colEl = document.createElement("col");
        colEl.className = "content-table__col--data";
        dataCols[col] = colEl;
        colgroup.appendChild(colEl);
    });
    table.appendChild(colgroup);

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const headerCells = {};
    let boolSumHeader = null;
    let boolSumValues = null;
    let boolSumRail = null;
    if (hasItems) {
        fillHeader = document.createElement("th");
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

    let minDataColumnWidthPx = 0;

    function measureMinDataColumnWidth() {
        const probe = document.createElement("div");
        probe.className = "content-table__width-probe";
        probe.style.width = "3cm";
        document.body.appendChild(probe);
        const width = probe.offsetWidth;
        document.body.removeChild(probe);
        return width;
    }

    function applyDataColumnWidths() {
        if (!minDataColumnWidthPx) {
            minDataColumnWidthPx = measureMinDataColumnWidth();
        }
        let totalWidth = 0;
        if (hasItems && fillCol && fillHeader) {
            const fillWidth = Math.ceil(fillHeader.getBoundingClientRect().width);
            fillCol.style.width = fillWidth + "px";
            totalWidth += fillWidth;
        }
        columns.forEach(function (col) {
            const headerWidth = Math.ceil(headerCells[col].th.getBoundingClientRect().width);
            const width = Math.max(headerWidth, minDataColumnWidthPx);
            dataCols[col].style.width = width + "px";
            totalWidth += width;
        });
        table.style.width = totalWidth + "px";
    }

    function markTruncatedCells() {
        requestAnimationFrame(function () {
            tbody.querySelectorAll(".content-table__cell--data").forEach(function (td) {
                const truncated = td.scrollWidth > td.clientWidth;
                td.classList.toggle("content-table__cell--truncated", truncated);
                if (truncated) {
                    td.setAttribute("tabindex", "0");
                } else {
                    td.removeAttribute("tabindex");
                }
            });
        });
    }

    function orderedRows() {
        if (sortState.column === null) return rowObjects;
        const column = sortState.column;
        const factor = sortState.dir === "desc" ? -1 : 1;
        return rowObjects.slice().sort(function (rowA, rowB) {
            if (column === "__boolSum") {
                return factor * (boolSum(rowA) - boolSum(rowB));
            }
            const a = rowA[column];
            const b = rowB[column];
            const aEmpty = a === undefined || a === null;
            const bEmpty = b === undefined || b === null;
            if (aEmpty || bEmpty) return aEmpty === bEmpty ? 0 : (aEmpty ? 1 : -1);
            return factor * compareNonEmpty(a, b);
        });
    }

    function renderBody() {
        closeCellOverlay();
        tbody.innerHTML = "";
        orderedRows().forEach(function (rowObj) {
            const tr = document.createElement("tr");
            tr.className = "content-table__row";
            if (hasItems) {
                const fillCell = document.createElement("td");
                fillCell.className = "content-table__cell content-table__cell--fill";
                fillCell.appendChild(createFillButton(rowIndex.get(rowObj)));
                tr.appendChild(fillCell);
            }
            columns.forEach(function (col) {
                const td = document.createElement("td");
                td.className = "content-table__cell content-table__cell--data";
                const value = rowObj[col];
                if (value !== undefined && typeof value === "object") {
                    td.classList.add("content-table__cell--json");
                }
                if (value === null) {
                    td.classList.add("content-table__cell--null");
                }
                const text = formatCellValue(value);
                if (isNumericCellText(text)) {
                    td.classList.add("content-table__cell--number");
                }
                td.textContent = text;
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        markTruncatedCells();
    }

    tbody.addEventListener("click", function (event) {
        const td = event.target.closest(".content-table__cell--truncated");
        if (!td || !tbody.contains(td)) return;
        openCellOverlay(td, td.textContent);
    });

    tbody.addEventListener("keydown", function (event) {
        if (event.key !== "Enter" && event.key !== " ") return;
        const td = event.target.closest(".content-table__cell--truncated");
        if (!td || !tbody.contains(td)) return;
        event.preventDefault();
        openCellOverlay(td, td.textContent);
    });

    function updateHeaders() {
        columns.forEach(function (col) {
            const cell = headerCells[col];
            const active = sortState.column === col;
            cell.th.classList.toggle("content-table__header-cell--sorted", active);
            cell.th.setAttribute(
                "aria-sort",
                active ? (sortState.dir === "asc" ? "ascending" : "descending") : "none"
            );
            cell.indicator.classList.toggle("content-table__sort-indicator--hint", !active);
            cell.indicator.innerHTML = window.AppIcons.markup(
                active ? (sortState.dir === "asc" ? "chevron-up" : "chevron-down") : "chevrons-up-down",
                "icon--sm"
            );
        });
        if (boolSumHeader) {
            const active = sortState.column === "__boolSum";
            boolSumHeader.classList.toggle("content-bool-sum__header--sorted", active);
            boolSumHeader.setAttribute(
                "aria-sort",
                active ? (sortState.dir === "asc" ? "ascending" : "descending") : "none"
            );
            boolSumHeader.querySelector(".content-bool-sum__sort-indicator").innerHTML = window.AppIcons.markup(
                active ? (sortState.dir === "asc" ? "chevron-up" : "chevron-down") : "chevrons-up-down",
                "icon--sm"
            );
        }
    }

    function syncBoolSumHeights() {
        if (!boolSumHeader || !boolSumValues || !table.isConnected) return;
        boolSumHeader.style.height = table.querySelector("thead tr").getBoundingClientRect().height + "px";
        const rows = table.querySelectorAll("tbody tr");
        Array.from(boolSumValues.children).forEach(function (value, index) {
            value.style.top = rows[index].offsetTop + "px";
            value.style.transform = "translateY(" + boolSumHeader.offsetHeight + "px)";
        });
    }

    if (showBoolSum) {
        boolSumRail = document.createElement("div");
        boolSumRail.className = "content-bool-sum";

        boolSumHeader = document.createElement("button");
        boolSumHeader.type = "button";
        boolSumHeader.className = "content-bool-sum__header";
        boolSumHeader.setAttribute("aria-sort", "none");
        boolSumHeader.setAttribute("aria-label", "Bool sum");
        boolSumHeader.append("Σ");
        const indicator = document.createElement("span");
        indicator.className = "content-bool-sum__sort-indicator";
        indicator.setAttribute("aria-hidden", "true");
        boolSumHeader.appendChild(indicator);
        boolSumHeader.addEventListener("click", function () {
            if (sortState.column === "__boolSum") {
                sortState.dir = sortState.dir === "asc" ? "desc" : "asc";
            } else {
                sortState.column = "__boolSum";
                sortState.dir = "asc";
            }
            renderBody();
            updateHeaders();
        });
        boolSumRail.appendChild(boolSumHeader);

        boolSumValues = document.createElement("div");
        boolSumValues.className = "content-bool-sum__values";
        boolSumRail.appendChild(boolSumValues);
        layout.appendChild(boolSumRail);

        const originalRenderBody = renderBody;
        renderBody = function () {
            originalRenderBody();
            boolSumValues.innerHTML = "";
            orderedRows().forEach(function (rowObj) {
                const value = document.createElement("div");
                value.className = "content-bool-sum__value";
                value.textContent = String(boolSum(rowObj));
                boolSumValues.appendChild(value);
            });
            syncBoolSumHeights();
        };
    }

    updateHeaders();
    wrapper.appendChild(table);
    layout.appendChild(wrapper);
    container.appendChild(layout);
    applyDataColumnWidths();
    table.classList.add("content-table--compact");
    renderBody();
    syncBoolSumHeights();
    requestAnimationFrame(syncBoolSumHeights);
    setTimeout(syncBoolSumHeights, 0);
    setTimeout(syncBoolSumHeights, 100);
    if (showBoolSum && typeof ResizeObserver === "function") {
        const observer = new ResizeObserver(syncBoolSumHeights);
        table.querySelectorAll("thead tr, tbody tr").forEach(function (row) {
            observer.observe(row);
        });
    }
}
