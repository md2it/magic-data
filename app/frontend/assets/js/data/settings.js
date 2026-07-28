import {
    PREF,
    readBool,
    writeBool,
    writeString,
} from "../shared/preferences.js";
import { defaultView } from "./app-state.js";

document.addEventListener("DOMContentLoaded", function () {
    const VALID_VIEWS = [
        { id: "table", label: "Table" },
        { id: "json", label: "JSON" },
        { id: "tree", label: "Tree" },
        { id: "text", label: "Text" },
    ];

    document.querySelectorAll("select[data-default-view]").forEach(function (sel) {
        VALID_VIEWS.forEach(function (view) {
            const option = document.createElement("option");
            option.value = view.id;
            option.textContent = view.label;
            sel.appendChild(option);
        });
        sel.value = defaultView();
        sel.addEventListener("change", function () {
            writeString(PREF.defaultView, sel.value);
        });
    });

    function rerenderOpenView() {
        if (window.MagicData && typeof window.MagicData.rerenderView === "function") {
            window.MagicData.rerenderView();
        }
    }

    document.querySelectorAll("input[data-boolean-icons]").forEach(function (toggle) {
        toggle.checked = readBool(PREF.booleanIcons, true);
        toggle.addEventListener("change", function () {
            writeBool(PREF.booleanIcons, toggle.checked);
            rerenderOpenView();
        });
    });

    document.querySelectorAll("input[data-bool-sum]").forEach(function (toggle) {
        toggle.checked = readBool(PREF.boolSum, true);
        toggle.addEventListener("change", function () {
            writeBool(PREF.boolSum, toggle.checked);
            rerenderOpenView();
        });
    });
});
