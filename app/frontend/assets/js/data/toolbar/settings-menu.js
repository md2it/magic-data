import { closeOtherMenus, registerMenuCloser } from "./menus.js";

export function initSettingsMenu() {
    const button = document.getElementById("data-settings-button");
    const popup = document.getElementById("data-settings-popup");
    if (!button || !popup) return;

    function closePopup() {
        popup.hidden = true;
        button.setAttribute("aria-expanded", "false");
    }
    registerMenuCloser(closePopup);

    popup.addEventListener("click", function (event) {
        event.stopPropagation();
    });

    button.addEventListener("click", function (event) {
        event.stopPropagation();
        const willOpen = popup.hidden;
        if (willOpen) closeOtherMenus(closePopup);
        popup.hidden = !willOpen;
        button.setAttribute("aria-expanded", String(willOpen));
    });

    document.addEventListener("click", function (event) {
        if (!popup.hidden && !popup.contains(event.target) && !button.contains(event.target)) {
            closePopup();
        }
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && !popup.hidden) closePopup();
    });
}
