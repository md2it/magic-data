/** Data page host: wire modules and boot on DOMContentLoaded. */
import "../magic-llm/index.js";
import "./number-format.js";
import "./content-view/index.js";
import "./content-view/table-hover.js";
import "./settings.js";
import { initSidebar } from "./sidebar.js";
import { dataFileUrl, installMagicData, loadFileTree, state } from "./app-state.js";
import {
    initFileTreeRootDrop,
    installFileTreeActions,
    renderTree,
    startCreateEntry,
} from "./file-tree.js";
import {
    applyInitialState,
    createStructuredFile,
    refreshTree,
    renderCurrentFile,
    selectFile,
    selectNewEntry,
} from "./navigation.js";
import { initCopyMenu, initDownloadMenu } from "./toolbar/copy-download.js";
import { initMagicButtons } from "./toolbar/magic-actions.js";
import { initSettingsMenu } from "./toolbar/settings-menu.js";
import { initViewSwitch } from "./toolbar/view-switch.js";

installFileTreeActions({
    createStructuredFile,
    refreshTree,
    selectFile,
    selectNewEntry,
});
installMagicData({ renderCurrentFile });

document.addEventListener("DOMContentLoaded", async function () {
    state.fileTreeRoot = document.getElementById("file-tree");
    initFileTreeRootDrop();

    state.currentTree = await loadFileTree();
    renderTree(state.fileTreeRoot, state.currentTree);

    initViewSwitch();
    applyInitialState();
    initSidebar();

    window.addEventListener("popstate", function () {
        window.location.reload();
    });

    document.getElementById("new-file").addEventListener("click", function () {
        startCreateEntry("", state.fileTreeRoot, "file");
    });
    document.getElementById("new-folder").addEventListener("click", function () {
        startCreateEntry("", state.fileTreeRoot, "dir");
    });

    document.getElementById("collapse-all").addEventListener("click", function () {
        window.ContentView.collapseAll(document.getElementById("file-content"));
    });
    document.getElementById("expand-all").addEventListener("click", function () {
        window.ContentView.expandAll(document.getElementById("file-content"));
    });
    document.getElementById("open-raw-json").addEventListener("click", function () {
        if (state.currentFilePath) {
            window.open(dataFileUrl(state.currentFilePath), "_blank", "noopener");
        }
    });

    initCopyMenu();
    initDownloadMenu();
    initSettingsMenu();
    initMagicButtons();
});
