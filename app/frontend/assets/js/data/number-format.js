/** Display-only digit grouping via CSS ::before (copy stays raw). Auto-wires [data-number-format]. */
import { PREF, readString, writeString } from "../shared/preferences.js";

(function () {
    "use strict";

    var DEFAULT_MODE = "grouped";
    var STYLE_ID = "number-format-style";
    var WRAP_CLASS = "fmt-number";
    var GROUP_CLASS = "fmt-group";

    var MODES = [
        { id: "grouped", label: "1,234,567.89 — grouped (3 digits)" },
        { id: "plain", label: "1234567.89 — plain (as in JSON)" },
        { id: "space", label: "1 234 567.89 — space-separated" },
        { id: "indian", label: "12,34,567.89 — Indian (3-2-2)" },
        { id: "chinese", label: "123,4567.89 — Chinese (4 digits)" }
    ];

    var excludeSel = ".json-node";
    // Skip form/script tags; <pre> is formatted unless excluded.
    var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1, OPTION: 1 };

    var NUM_RE = /^(-?)(\d+)(\.\d+)?$/;
    var OBS_OPTS = { childList: true, subtree: true, characterData: true };
    var observer = null;

    function getMode() {
        return readString(PREF.numberFormat, DEFAULT_MODE) || DEFAULT_MODE;
    }

    function setMode(mode) {
        writeString(PREF.numberFormat, mode);
        refresh();
        syncSelects();
    }

    // Group sizes: 3 / chinese 4 / indian 3-then-2s.
    function splitGroups(intStr, mode) {
        var groups = [];
        if (mode === "indian") {
            if (intStr.length <= 3) return [intStr];
            groups.unshift(intStr.slice(-3));
            var head = intStr.slice(0, -3);
            while (head.length > 2) {
                groups.unshift(head.slice(-2));
                head = head.slice(0, -2);
            }
            if (head.length) groups.unshift(head);
            return groups;
        }
        var size = mode === "chinese" ? 4 : 3;
        for (var end = intStr.length; end > 0; end -= size) {
            groups.unshift(intStr.slice(Math.max(0, end - size), end));
        }
        return groups;
    }

    function isSkipped(node) {
        for (var el = node.parentNode; el && el.nodeType === 1; el = el.parentNode) {
            if (SKIP_TAGS[el.tagName]) return true;
            if (el.isContentEditable) return true;
            if (el.classList && el.classList.contains(WRAP_CLASS)) return true;
            if (excludeSel && el.matches && el.matches(excludeSel)) return true;
        }
        return false;
    }

    function wrapTextNode(textNode) {
        var raw = textNode.nodeValue;
        var trimmed = raw.trim();
        var m = NUM_RE.exec(trimmed);
        if (!m) return;

        var sign = m[1];
        var intPart = m[2];
        var frac = m[3] || "";
        // Zero-padded integers are almost always codes/IDs, not quantities.
        if (intPart.length > 1 && intPart.charAt(0) === "0") return;

        var mode = getMode();
        if (mode === "plain") return;
        var groups = splitGroups(intPart, mode);
        if (groups.length < 2) return;

        var wrapper = document.createElement("span");
        wrapper.className = WRAP_CLASS + " " + (mode === "space" ? "fmt-sep-space" : "fmt-sep-comma");
        if (sign) wrapper.appendChild(document.createTextNode(sign));
        groups.forEach(function (group) {
            var span = document.createElement("span");
            span.className = GROUP_CLASS;
            span.textContent = group;
            wrapper.appendChild(span);
        });
        if (frac) wrapper.appendChild(document.createTextNode(frac));

        var parent = textNode.parentNode;
        if (!parent) return;
        var lead = raw.match(/^\s*/)[0];
        var trail = raw.match(/\s*$/)[0];
        if (lead) parent.insertBefore(document.createTextNode(lead), textNode);
        parent.insertBefore(wrapper, textNode);
        if (trail) parent.insertBefore(document.createTextNode(trail), textNode);
        parent.removeChild(textNode);
    }

    function scan(root) {
        if (!root) return;
        if (root.nodeType === 3) {
            if (!isSkipped(root)) wrapTextNode(root);
            return;
        }
        if (root.nodeType !== 1) return;
        if (SKIP_TAGS[root.tagName] || root.isContentEditable) return;
        if (excludeSel && root.matches && root.matches(excludeSel)) return;

        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: function (n) {
                return isSkipped(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
            }
        });
        // Collect first: wrapping mutates the tree the walker is traversing.
        var nodes = [];
        var n;
        while ((n = walker.nextNode())) nodes.push(n);
        nodes.forEach(wrapTextNode);
    }

    function unwrapAll(root) {
        var wraps = (root || document.body).querySelectorAll("." + WRAP_CLASS);
        wraps.forEach(function (w) {
            var parent = w.parentNode;
            if (!parent) return;
            parent.replaceChild(document.createTextNode(w.textContent), w);
            parent.normalize();
        });
    }

    function refresh() {
        if (observer) observer.disconnect();
        unwrapAll(document.body);
        scan(document.body);
        if (observer) observer.observe(document.body, OBS_OPTS);
    }

    function startObserver() {
        if (observer || !window.MutationObserver) return;
        observer = new MutationObserver(function (mutations) {
            // Detach while we mutate so our own spans don't re-trigger us.
            observer.disconnect();
            mutations.forEach(function (mut) {
                if (mut.addedNodes) mut.addedNodes.forEach(scan);
                if (mut.type === "characterData" && !isSkipped(mut.target)) {
                    wrapTextNode(mut.target);
                }
            });
            observer.observe(document.body, OBS_OPTS);
        });
        observer.observe(document.body, OBS_OPTS);
    }

    function syncSelects() {
        document.querySelectorAll("select[data-number-format]").forEach(function (sel) {
            if (sel.value !== getMode()) sel.value = getMode();
        });
    }

    function wireSelects() {
        document.querySelectorAll("select[data-number-format]").forEach(function (sel) {
            if (sel.dataset.nfWired) return;
            sel.dataset.nfWired = "1";
            if (!sel.options.length) {
                MODES.forEach(function (mode) {
                    var option = document.createElement("option");
                    option.value = mode.id;
                    option.textContent = mode.label;
                    sel.appendChild(option);
                });
            }
            sel.value = getMode();
            sel.addEventListener("change", function () { setMode(sel.value); });
        });
    }

    function injectCSS() {
        if (document.getElementById(STYLE_ID)) return;
        var style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = [
            /* Tabular nums + slashed zero. */
            "body{font-variant-numeric:slashed-zero tabular-nums;}",
            "." + "fmt-sep-comma ." + GROUP_CLASS + "+." + GROUP_CLASS + "::before{content:\",\";}",
            /* NBSP keeps number on one line */
            "." + "fmt-sep-space ." + GROUP_CLASS + "+." + GROUP_CLASS + "::before{content:\"\\00a0\";}"
        ].join("\n");
        (document.head || document.documentElement).appendChild(style);
    }

    function init() {
        injectCSS();
        scan(document.body);
        wireSelects();
        startObserver();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    window.NumberFormat = {
        modes: MODES,
        getMode: getMode,
        setMode: setMode,
        refresh: refresh
    };
})();
