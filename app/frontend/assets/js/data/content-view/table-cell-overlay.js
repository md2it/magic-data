/** Floating overlay for full truncated table cell text. Mounted on document.body. */

const EDGE = 6;
const MAX_VP_FRAC = 0.5;
const MAX_ASPECT = 3;
const PAD_X = 12;
const PAD_Y = 8;

let overlay = null;
let contentEl = null;
let activeCell = null;
let measureProbe = null;

function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.className = "table-cell-overlay";
    overlay.tabIndex = -1;
    overlay.hidden = true;
    contentEl = document.createElement("div");
    contentEl.className = "table-cell-overlay__content";
    overlay.appendChild(contentEl);
    overlay.addEventListener("focusout", function (event) {
        const related = event.relatedTarget;
        if (related && (overlay.contains(related) || related === activeCell)) return;
        closeCellOverlay();
    });
    document.body.appendChild(overlay);
    return overlay;
}

function ensureMeasureProbe() {
    if (measureProbe) return measureProbe;
    measureProbe = document.createElement("div");
    measureProbe.className = "table-cell-overlay__measure";
    measureProbe.setAttribute("aria-hidden", "true");
    document.body.appendChild(measureProbe);
    return measureProbe;
}

function measureWrappedHeight(text, innerWidth) {
    const probe = ensureMeasureProbe();
    probe.style.width = innerWidth + "px";
    probe.textContent = text;
    return probe.scrollHeight;
}

function measureNowrapWidth(text) {
    const probe = ensureMeasureProbe();
    probe.style.width = "auto";
    probe.style.whiteSpace = "nowrap";
    probe.textContent = text;
    const width = probe.scrollWidth;
    probe.style.whiteSpace = "";
    return width;
}

function enforceAspect(boxW, boxH, maxW, maxH) {
    let w = boxW;
    let h = boxH;
    if (w > maxW) {
        w = maxW;
        h = Math.min(h, maxH);
    }
    if (h > maxH) {
        h = maxH;
        w = Math.min(w, maxW);
    }
    const ratio = Math.max(w, h) / Math.max(Math.min(w, h), 1);
    if (ratio > MAX_ASPECT) {
        if (w >= h) {
            h = Math.ceil(w / MAX_ASPECT);
            if (h > maxH) {
                h = maxH;
                w = Math.min(Math.ceil(h * MAX_ASPECT), maxW);
            }
        } else {
            w = Math.ceil(h / MAX_ASPECT);
            if (w > maxW) {
                w = maxW;
                h = Math.min(Math.ceil(w / MAX_ASPECT), maxH);
            }
        }
    }
    return { width: w, height: h };
}

function computeOverlayBox(text, anchorWidth) {
    const maxW = Math.floor(window.innerWidth * MAX_VP_FRAC);
    const maxH = Math.floor(window.innerHeight * MAX_VP_FRAC);
    const innerMaxW = Math.max(maxW - PAD_X * 2, 1);
    const innerMaxH = Math.max(maxH - PAD_Y * 2, 1);

    const naturalInnerW = measureNowrapWidth(text);
    let innerW = Math.min(Math.max(naturalInnerW, Math.min(anchorWidth, innerMaxW)), innerMaxW);
    innerW = Math.max(innerW, 1);

    let innerH = measureWrappedHeight(text, innerW);

    while (innerH > MAX_ASPECT * innerW && innerW < innerMaxW) {
        innerW = Math.min(innerW + 24, innerMaxW);
        innerH = measureWrappedHeight(text, innerW);
    }

    let boxW = innerW + PAD_X * 2;
    let boxH = innerH + PAD_Y * 2;

    if (boxW > maxW) {
        boxW = maxW;
        innerW = boxW - PAD_X * 2;
        innerH = measureWrappedHeight(text, innerW);
        boxH = Math.min(innerH + PAD_Y * 2, maxH);
    }
    if (boxH > maxH) {
        boxH = maxH;
    }

    const sized = enforceAspect(boxW, boxH, maxW, maxH);
    const needsScroll = innerH + PAD_Y * 2 > sized.height;
    return { width: sized.width, height: sized.height, needsScroll: needsScroll };
}

function positionOverlay(cell, text) {
    const el = ensureOverlay();
    const rect = cell.getBoundingClientRect();
    const box = computeOverlayBox(text, rect.width);

    contentEl.textContent = text;
    el.style.width = box.width + "px";
    el.style.height = box.height + "px";
    contentEl.style.maxHeight = box.height - PAD_Y * 2 + "px";
    contentEl.style.overflowY = box.needsScroll ? "auto" : "visible";

    let left = rect.left;
    let top = rect.top;
    left = Math.max(EDGE, Math.min(left, window.innerWidth - box.width - EDGE));
    top = Math.max(EDGE, Math.min(top, window.innerHeight - box.height - EDGE));

    el.style.left = Math.round(left) + "px";
    el.style.top = Math.round(top) + "px";
}

export function closeCellOverlay() {
    if (!overlay) return;
    overlay.hidden = true;
    activeCell = null;
}

export function openCellOverlay(cell, text) {
    if (activeCell === cell && overlay && !overlay.hidden) {
        overlay.focus();
        return;
    }
    closeCellOverlay();
    activeCell = cell;
    positionOverlay(cell, text);
    overlay.hidden = false;
    overlay.focus();
}
