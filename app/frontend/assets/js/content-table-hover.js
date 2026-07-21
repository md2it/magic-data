/*
 * content-table-hover.js
 *
 * Crosshair hover for the Table view: highlights the hovered cell's row and
 * column. Self-contained — injects its own styles and uses document-level
 * event delegation, so it survives table re-renders (sort, view switch).
 *
 * Theme-agnostic colours (#012292): row/column fill at 2%, cell at 5%,
 * frame at 20%. Frame edges are painted with inset box-shadow so they never
 * affect layout; each shared edge between two highlighted cells is drawn
 * once (trailing right/bottom ownership) to avoid double borders.
 */
(function () {
    "use strict";

    var STYLE_ID = "content-table-hover-styles";
    var CLASS_ROW = "content-table__hover-row";
    var CLASS_COL = "content-table__hover-col";
    var CLASS_BODY = "content-table__hover-body";
    var OVERLAY = "rgba(1, 34, 146, 0.02)";
    var OVERLAY_CELL = "rgba(1, 34, 146, 0.05)";
    var BORDER = "rgba(1, 34, 146, 0.2)";

    var EDGE_T = "inset 0 1px 0 0 " + BORDER;
    var EDGE_B = "inset 0 -1px 0 0 " + BORDER;
    var EDGE_L = "inset 1px 0 0 0 " + BORDER;
    var EDGE_R = "inset -1px 0 0 0 " + BORDER;

    var activeTable = null;
    var activeRow = null;
    var activeCol = -1;
    var painted = [];

    function ensureStyles() {
        if (document.getElementById(STYLE_ID)) return;
        var style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent =
            /* Body cells need a stacking context so the frame sits above zebra
               fills; keep thead on position:sticky from the base stylesheet. */
            ".content-table tbody ." + CLASS_BODY + "{" +
            "position:relative;" +
            "z-index:1;" +
            "}" +
            ".content-table thead ." + CLASS_COL + "{" +
            "z-index:2;" +
            "}";
        document.head.appendChild(style);
    }

    function isHighlighted(cell) {
        var row = cell.parentElement;
        return (activeRow && row === activeRow) || cell.cellIndex === activeCol;
    }

    function cellAbove(cell) {
        var row = cell.parentElement;
        var prev = row && row.previousElementSibling;
        if (!prev || (prev.tagName !== "TR")) {
            var section = row.parentElement;
            var prevSection = section && section.previousElementSibling;
            if (!prevSection) return null;
            prev = prevSection.lastElementChild;
        }
        if (!prev || prev.tagName !== "TR") return null;
        return prev.children[cell.cellIndex] || null;
    }

    function paintCell(cell) {
        var prev = cell.previousElementSibling;
        var above = cellAbove(cell);
        var fill = (cell.parentElement === activeRow && cell.cellIndex === activeCol)
            ? OVERLAY_CELL
            : OVERLAY;
        var parts = ["inset 0 0 0 9999px " + fill];
        // Trailing edges: always. Leading edges: only on the outer side of a
        // highlighted run, so a shared edge between two highlighted cells is
        // drawn once.
        parts.push(EDGE_R);
        parts.push(EDGE_B);
        if (!prev || !isHighlighted(prev)) parts.push(EDGE_L);
        if (!above || !isHighlighted(above)) parts.push(EDGE_T);
        cell.style.boxShadow = parts.join(",");
        cell.classList.add(CLASS_BODY);
        if (cell.cellIndex === activeCol) cell.classList.add(CLASS_COL);
        painted.push(cell);
    }

    function clearHover() {
        if (!activeTable) return;
        if (activeRow) activeRow.classList.remove(CLASS_ROW);
        painted.forEach(function (el) {
            el.style.boxShadow = "";
            el.classList.remove(CLASS_BODY, CLASS_COL);
        });
        painted = [];
        activeTable = null;
        activeRow = null;
        activeCol = -1;
    }

    function setHover(cell) {
        var table = cell.closest(".content-table");
        if (!table) return;
        var row = cell.parentElement;
        var col = cell.cellIndex;
        if (table === activeTable && row === activeRow && col === activeCol) return;

        clearHover();
        activeTable = table;
        activeRow = row;
        activeCol = col;
        row.classList.add(CLASS_ROW);

        var seen = new Set();
        Array.prototype.forEach.call(row.children, function (el) {
            paintCell(el);
            seen.add(el);
        });
        table.querySelectorAll("tr > :nth-child(" + (col + 1) + ")").forEach(function (el) {
            if (seen.has(el)) return;
            paintCell(el);
        });
    }

    function cellFrom(node) {
        return node instanceof Element ? node.closest(".content-table td, .content-table th") : null;
    }

    ensureStyles();

    document.addEventListener("mouseover", function (event) {
        var cell = cellFrom(event.target);
        if (cell) setHover(cell);
    });

    document.addEventListener("mouseout", function (event) {
        var cell = cellFrom(event.target);
        if (!cell) return;
        var next = cellFrom(event.relatedTarget);
        if (next && next.closest(".content-table") === cell.closest(".content-table")) return;
        clearHover();
    });
})();
