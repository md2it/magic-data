/*
 * content-table-hover.js
 *
 * Crosshair hover for the Table view: highlights the hovered/focused cell's
 * row and column. Also drives contextual Magic Fill visibility via
 * `.magic-contextual-active` on the table, active body row, and active
 * column header — without removing buttons from the DOM or changing layout.
 *
 * Self-contained — injects its own styles and uses document-level event
 * delegation, so it survives table re-renders (sort, view switch).
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
    var CLASS_MAGIC = "magic-contextual-active";
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
    var activeMagicRow = null;
    var activeMagicColHeader = null;
    var painted = [];

    // Pointer and keyboard focus are tracked separately so leaving one while
    // the other remains does not clear the logical active state (avoids
    // flicker when moving between a cell and its Magic button, and keeps
    // crosshair/buttons while the pointer stays in the table after blur).
    var pointerCell = null;
    var focusCell = null;

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

    function clearPaint() {
        if (activeRow) activeRow.classList.remove(CLASS_ROW);
        painted.forEach(function (el) {
            el.style.boxShadow = "";
            el.classList.remove(CLASS_BODY, CLASS_COL);
        });
        painted = [];
        activeRow = null;
        activeCol = -1;
    }

    function clearMagic() {
        if (activeTable) activeTable.classList.remove(CLASS_MAGIC);
        if (activeMagicRow) {
            activeMagicRow.classList.remove(CLASS_MAGIC);
            activeMagicRow = null;
        }
        if (activeMagicColHeader) {
            activeMagicColHeader.classList.remove(CLASS_MAGIC);
            activeMagicColHeader = null;
        }
    }

    function clearHover() {
        if (!activeTable) return;
        clearMagic();
        clearPaint();
        activeTable = null;
    }

    function isBodyRow(row) {
        return row && row.parentElement && row.parentElement.tagName === "TBODY";
    }

    function headerCellAt(table, col) {
        var headRow = table.tHead && table.tHead.rows[0];
        return headRow ? headRow.cells[col] || null : null;
    }

    /**
     * Update Magic contextual classes without an empty intermediate frame, so
     * moving between cells does not restart hide/show transitions on Fill All
     * or on the still-active row/column control.
     */
    function syncMagic(table, row, col) {
        if (activeTable && activeTable !== table) {
            activeTable.classList.remove(CLASS_MAGIC);
            if (activeMagicRow) {
                activeMagicRow.classList.remove(CLASS_MAGIC);
                activeMagicRow = null;
            }
            if (activeMagicColHeader) {
                activeMagicColHeader.classList.remove(CLASS_MAGIC);
                activeMagicColHeader = null;
            }
        }
        table.classList.add(CLASS_MAGIC);

        var nextMagicRow = isBodyRow(row) ? row : null;
        if (activeMagicRow && activeMagicRow !== nextMagicRow) {
            activeMagicRow.classList.remove(CLASS_MAGIC);
        }
        if (nextMagicRow) nextMagicRow.classList.add(CLASS_MAGIC);
        activeMagicRow = nextMagicRow;

        // Column fill lives on data headers only (cellIndex > 0 when a leading
        // Fill All column is present; still safe if that column is absent).
        var nextHeader = null;
        if (col > 0) {
            var candidate = headerCellAt(table, col);
            if (candidate && candidate.querySelector(".content-table__col-fill")) {
                nextHeader = candidate;
            }
        }
        if (activeMagicColHeader && activeMagicColHeader !== nextHeader) {
            activeMagicColHeader.classList.remove(CLASS_MAGIC);
        }
        if (nextHeader) nextHeader.classList.add(CLASS_MAGIC);
        activeMagicColHeader = nextHeader;
    }

    function setHover(cell) {
        var table = cell.closest(".content-table");
        if (!table) return;
        var row = cell.parentElement;
        var col = cell.cellIndex;
        if (table === activeTable && row === activeRow && col === activeCol) {
            syncMagic(table, row, col);
            return;
        }

        if (table !== activeTable) {
            clearHover();
            activeTable = table;
        } else {
            clearPaint();
        }

        activeRow = row;
        activeCol = col;
        row.classList.add(CLASS_ROW);
        syncMagic(table, row, col);

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

    function refresh() {
        // Pointer wins while it remains inside the table so moving between a
        // cell and its Magic button stays stable; keyboard focus is used when
        // the pointer is outside (or absent).
        var cell = pointerCell || focusCell;
        if (cell && cell.isConnected) setHover(cell);
        else clearHover();
    }

    function cellFrom(node) {
        return node instanceof Element ? node.closest(".content-table td, .content-table th") : null;
    }

    function sameTable(a, b) {
        return a && b && a.closest(".content-table") === b.closest(".content-table");
    }

    ensureStyles();

    document.addEventListener("mouseover", function (event) {
        var cell = cellFrom(event.target);
        if (!cell) return;
        pointerCell = cell;
        refresh();
    });

    document.addEventListener("mouseout", function (event) {
        var cell = cellFrom(event.target);
        if (!cell) return;
        var next = cellFrom(event.relatedTarget);
        if (sameTable(cell, next)) return;
        pointerCell = null;
        refresh();
    });

    document.addEventListener("focusin", function (event) {
        var cell = cellFrom(event.target);
        if (!cell) return;
        focusCell = cell;
        refresh();
    });

    document.addEventListener("focusout", function (event) {
        var cell = cellFrom(event.target);
        if (!cell) return;
        var next = cellFrom(event.relatedTarget);
        if (sameTable(cell, next)) return;
        focusCell = null;
        refresh();
    });
})();
