/*
 * tooltip.js
 *
 * The product's single tooltip. A self-contained, autonomous drop-in: on load
 * it wires document-level listeners and manages one reusable #app-tooltip
 * element. Any element with a `data-tooltip="..."` attribute shows that text on
 * hover and on keyboard focus — no per-call setup.
 *
 * The tooltip is appended to <body> and positioned with fixed coordinates, so
 * it escapes any clipping ancestor (toolbars, scrolling tables) and always sits
 * on the top layer. Appearance is owned by /assets/css/tooltip.css.
 *
 * See /documentation/developers/ui/components (Tooltips).
 */
(function () {
    "use strict";

    var SHOW_DELAY = 120;   // ms before a hovered tooltip appears
    var GAP = 8;            // px between the target and the tooltip
    var EDGE = 6;           // px minimum distance from the viewport edge

    var tip = null;
    var current = null;     // the trigger the tooltip currently describes
    var showTimer = null;

    function ensureTip() {
        if (tip) return tip;
        tip = document.createElement("div");
        tip.id = "app-tooltip";
        tip.setAttribute("role", "tooltip");
        document.body.appendChild(tip);
        return tip;
    }

    function triggerFrom(node) {
        return node instanceof Element ? node.closest("[data-tooltip]") : null;
    }

    function position(target) {
        var t = ensureTip();
        var rect = target.getBoundingClientRect();
        // Measurable even while hidden (visibility, not display:none).
        var width = t.offsetWidth;
        var height = t.offsetHeight;

        var targetCenter = rect.left + rect.width / 2;
        var left = targetCenter - width / 2;
        left = Math.max(EDGE, Math.min(left, window.innerWidth - width - EDGE));

        var side = "top";
        var top = rect.top - height - GAP;
        if (top < EDGE) {
            side = "bottom";
            top = rect.bottom + GAP;
        }

        t.dataset.side = side;
        t.style.left = Math.round(left) + "px";
        t.style.top = Math.round(top) + "px";

        var tailX = targetCenter - left;
        tailX = Math.max(12, Math.min(tailX, width - 12));
        t.style.setProperty("--app-tooltip-tail-x", Math.round(tailX) + "px");
    }

    function show(target) {
        var text = target.getAttribute("data-tooltip");
        if (!text) return;
        var t = ensureTip();
        t.textContent = text;
        current = target;
        position(target);
        t.classList.add("app-tooltip--visible");
    }

    function scheduleShow(target) {
        clearTimeout(showTimer);
        showTimer = setTimeout(function () { show(target); }, SHOW_DELAY);
    }

    function hide() {
        clearTimeout(showTimer);
        current = null;
        if (tip) tip.classList.remove("app-tooltip--visible");
    }

    document.addEventListener("pointerover", function (event) {
        var target = triggerFrom(event.target);
        if (target && target !== current) scheduleShow(target);
    });

    document.addEventListener("pointerout", function (event) {
        if (!current) return;
        var to = event.relatedTarget;
        if (to && current.contains(to)) return;   // moved within the same trigger
        hide();
    });

    document.addEventListener("focusin", function (event) {
        var target = triggerFrom(event.target);
        if (target) show(target);
        else hide();
    });

    document.addEventListener("focusout", hide);
    document.addEventListener("pointerdown", hide);
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") hide();
    });
    // A moved or resized viewport invalidates the fixed position; hide rather
    // than chase it.
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
})();
