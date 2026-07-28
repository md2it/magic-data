import { PREF, readString } from "../shared/preferences.js";

export const VALID_VIEWS = ["json", "tree", "table", "text"];
const FALLBACK_DEFAULT_VIEW = "table";

export const state = {
    fileTreeRoot: null,
    currentTree: [],
    currentMode: "doc",
    currentFilePath: "",
    currentFileText: "",
    currentDirPath: "",
};

export function defaultView() {
    const stored = readString(PREF.defaultView, FALLBACK_DEFAULT_VIEW);
    return VALID_VIEWS.includes(stored) ? stored : FALLBACK_DEFAULT_VIEW;
}

export function currentView() {
    const active = document.querySelector("#view-switch .view-switch__option.active");
    return active ? active.dataset.view : defaultView();
}

export async function loadFileTree() {
    const response = await fetch("/api/data-tree");
    return response.json();
}

export async function loadFileContent(path) {
    const response = await fetch(dataFileUrl(path));
    return response.text();
}

export function dataFileUrl(path) {
    return `/api/data-files/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export function installMagicData(deps) {
    window.MagicData = {
        currentContext: function () {
            return {
                document: {
                    path: state.currentFilePath,
                    name: state.currentFilePath.split("/").pop()
                },
                view: currentView()
            };
        },
        rerenderView: function () {
            if (state.currentMode === "doc" && state.currentFilePath) {
                deps.renderCurrentFile();
            }
        },
        reloadDocument: async function () {
            if (state.currentMode === "doc" && state.currentFilePath) {
                state.currentFileText = await loadFileContent(state.currentFilePath);
                deps.renderCurrentFile();
            }
        }
    };
}
