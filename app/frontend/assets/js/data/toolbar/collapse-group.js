import { currentView } from "../app-state.js";

const VIEWS_WITH_COLLAPSE_CONTROLS = ["json", "tree"];

export function updateToolbarActions() {
    const group = document.getElementById("collapse-expand-group");
    group.hidden = !VIEWS_WITH_COLLAPSE_CONTROLS.includes(currentView());
}
