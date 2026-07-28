import { PREF, readString, writeString } from "../shared/preferences.js";

export function initSidebar() {
    const sidebar = document.getElementById("app-sidebar");
    const toggle = document.getElementById("sidebar-collapse");
    if (!sidebar || !toggle) return;

    const hoverExpandClass = "app-body__sidebar--hover-expand";
    let collapsed = false;

    function armHoverExpand() {
        if (sidebar.classList.contains("app-body__sidebar--collapsed")) {
            sidebar.classList.add(hoverExpandClass);
        }
    }

    function setCollapsed(shouldCollapse) {
        collapsed = shouldCollapse;
        sidebar.classList.toggle("app-body__sidebar--collapsed", shouldCollapse);
        sidebar.classList.remove(hoverExpandClass);
        toggle.setAttribute("aria-expanded", String(!shouldCollapse));
        const label = shouldCollapse ? "Expand sidebar" : "Collapse sidebar";
        toggle.setAttribute("aria-label", label);
        toggle.dataset.tooltip = label;
        window.AppIcons.setLabel(toggle, shouldCollapse ? "chevron-right" : "chevron-left");
        writeString(PREF.sidebarCollapsed, shouldCollapse ? "1" : "0");
    }

    collapsed = readString(PREF.sidebarCollapsed, "0") === "1";
    setCollapsed(collapsed);

    toggle.addEventListener("click", function () {
        setCollapsed(!collapsed);
    });
    sidebar.addEventListener("mouseenter", armHoverExpand);
    sidebar.addEventListener("focusin", armHoverExpand);
}
