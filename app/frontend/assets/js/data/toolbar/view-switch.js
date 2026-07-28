import { state } from "../app-state.js";
import { renderCurrentFile, setActiveView, updateUrl } from "../navigation.js";
import { updateToolbarActions } from "./collapse-group.js";

export function initViewSwitch() {
    const switchEl = document.getElementById("view-switch");
    switchEl.querySelectorAll(".view-switch__option").forEach(function (option) {
        option.addEventListener("click", function () {
            if (state.currentMode !== "doc") return;
            setActiveView(option.dataset.view);
            renderCurrentFile();
            updateUrl(false);
        });
    });
    updateToolbarActions();
}
