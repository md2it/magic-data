import { state } from "../app-state.js";
import { createStructuredFile, refreshTree } from "../navigation.js";
import { closeOtherMenus, registerMenuCloser } from "./menus.js";

export function initMagicButtons() {
    const sidebarToolbar = document.querySelector(".sidebar-toolbar");
    if (sidebarToolbar) {
        const structuredButton = document.createElement("button");
        structuredButton.type = "button";
        structuredButton.className = "sidebar-toolbar__button sidebar-toolbar__button--icon";
        structuredButton.innerHTML = window.AppIcons.markup("file-plus") + window.AppIcons.markup("sparkles");
        structuredButton.setAttribute("aria-label", "New file using Magic AI");
        structuredButton.dataset.tooltip = "New file using Magic AI";
        structuredButton.addEventListener("click", async function () {
            const data = await createStructuredFile(structuredButton, "");
            if (data) await refreshTree();
        });
        sidebarToolbar.appendChild(structuredButton);
    }

    const toolbarActions = document.getElementById("content-toolbar-actions");
    if (toolbarActions) {
        const structureRoot = document.createElement("div");
        structureRoot.className = "content-toolbar__menu";

        const structureButton = document.createElement("button");
        structureButton.type = "button";
        structureButton.className = "content-toolbar__button content-toolbar__button--icon";
        structureButton.id = "data-structure-button";
        structureButton.setAttribute("aria-haspopup", "dialog");
        structureButton.setAttribute("aria-expanded", "false");
        structureButton.setAttribute("aria-label", "Data structure");
        structureButton.dataset.tooltip = "data-structure";
        structureButton.innerHTML = window.AppIcons.markup("columns-3-cog");

        const popup = document.createElement("div");
        popup.className = "data-structure-popup";
        popup.id = "data-structure-popup";
        popup.setAttribute("role", "dialog");
        popup.setAttribute("aria-label", "Data structure");
        popup.hidden = true;

        const popupHeader = document.createElement("div");
        popupHeader.className = "data-structure-popup__header";

        const popupTitle = document.createElement("span");
        popupTitle.className = "data-structure-popup__title";
        popupTitle.textContent = "Data structure";

        const structureSwitch = document.createElement("div");
        structureSwitch.className = "view-switch data-structure-popup__switch";
        structureSwitch.setAttribute("role", "radiogroup");
        structureSwitch.setAttribute("aria-label", "Data structure view");

        let structureView = "tree";
        ["Tree", "JSON"].forEach(function (label) {
            const option = document.createElement("button");
            option.type = "button";
            option.className = "view-switch__option";
            option.dataset.structureView = label.toLowerCase();
            option.setAttribute("role", "radio");
            option.textContent = label;
            structureSwitch.appendChild(option);
        });

        const popupContent = document.createElement("div");
        popupContent.className = "data-structure-popup__content";

        popup.addEventListener("click", function (event) {
            event.stopPropagation();
        });

        function renderStructure() {
            structureSwitch.querySelectorAll("[data-structure-view]").forEach(function (option) {
                const active = option.dataset.structureView === structureView;
                option.classList.toggle("active", active);
                option.setAttribute("aria-checked", String(active));
            });
            window.ContentView.renderStructure(state.currentFileText, structureView, popupContent);
        }

        structureSwitch.addEventListener("click", function (event) {
            const option = event.target.closest("[data-structure-view]");
            if (!option) return;
            structureView = option.dataset.structureView;
            renderStructure();
        });

        const fixButton = document.createElement("button");
        fixButton.type = "button";
        fixButton.className = "content-toolbar__dropdown-item data-structure-popup__fix";
        window.AppIcons.setLabel(fixButton, "sparkles", "Update structure");
        fixButton.addEventListener("click", async function () {
            const data = await window.magicLlm.runScenario("fix-structure", {
                context: window.MagicData.currentContext(),
                button: fixButton
            });
            if (data) {
                await window.MagicData.reloadDocument();
                renderStructure();
            }
        });

        popupHeader.append(popupTitle, fixButton, structureSwitch);
        popup.append(popupHeader, popupContent);
        structureRoot.append(structureButton, popup);

        function closeStructurePopup() {
            popup.hidden = true;
            structureButton.setAttribute("aria-expanded", "false");
        }

        structureButton.addEventListener("click", function (event) {
            event.stopPropagation();
            const willOpen = popup.hidden;
            if (willOpen) {
                closeOtherMenus(closeStructurePopup);
                renderStructure();
            }
            popup.hidden = !willOpen;
            structureButton.setAttribute("aria-expanded", String(willOpen));
        });
        document.addEventListener("click", function (event) {
            if (!popup.hidden && !popup.contains(event.target) && !structureButton.contains(event.target)) {
                closeStructurePopup();
            }
        });
        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && !popup.hidden) closeStructurePopup();
        });
        registerMenuCloser(closeStructurePopup);

        const customButton = document.createElement("button");
        customButton.type = "button";
        customButton.className = "content-toolbar__button content-toolbar__button--icon";
        customButton.id = "magic-custom-button";
        customButton.setAttribute("aria-label", "Magic assistant");
        customButton.dataset.tooltip = "Magic assistant";
        customButton.innerHTML = window.AppIcons.markup("sparkles");
        customButton.addEventListener("click", async function () {
            const data = await window.magicLlm.runScenario("custom-edit", {
                context: window.MagicData.currentContext(),
                button: customButton
            });
            if (data) await window.MagicData.reloadDocument();
        });

        const fragment = document.createDocumentFragment();
        fragment.append(customButton, structureRoot);
        toolbarActions.insertBefore(fragment, toolbarActions.firstChild);
    }
}
