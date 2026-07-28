import { isPlainObject } from "./helpers.js";

function onFillClick(event, index, btn) {
    event.stopPropagation();
    const ctx = window.MagicData.currentContext();
    window.magicLlm.runScenario("fill-item", {
        context: Object.assign({}, ctx, { item: { index: index } }),
        button: btn
    }).then(function (data) { if (data) window.MagicData.reloadDocument(); });
}

export function createFillButton(index) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "magic-inline-btn magic-contextual-btn";
    btn.setAttribute("aria-label", "Fill missing values");
    btn.dataset.tooltip = "Fill missing values";
    btn.innerHTML = window.AppIcons.markup("sparkles");
    btn.addEventListener("click", function (event) {
        onFillClick(event, index, btn);
    });
    return btn;
}

export function createFillAllButton() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "magic-inline-btn magic-contextual-btn magic-fill-all-btn";
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
    event.stopPropagation();
    const ctx = window.MagicData.currentContext();
    window.magicLlm.runScenario("fill-column", {
        context: Object.assign({}, ctx, { column: { key: key } }),
        button: btn
    }).then(function (data) { if (data) window.MagicData.reloadDocument(); });
}

/** Column-header fill; stopPropagation so sort is not triggered. */
export function createColumnFillButton(key) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "magic-inline-btn magic-contextual-btn content-table__col-fill";
    btn.setAttribute("aria-label", "Fill this column");
    btn.dataset.tooltip = "Fill this column";
    btn.innerHTML = window.AppIcons.markup("sparkles");
    btn.addEventListener("click", function (event) {
        onFillColumnClick(event, key, btn);
    });
    btn.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") event.stopPropagation();
    });
    return btn;
}

/** Path is items[<n>] and value is a plain object. */
export function isFillableItemPath(path, value) {
    return path.length === 2 && path[0] === "items" &&
        typeof path[1] === "number" && isPlainObject(value);
}
