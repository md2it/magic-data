const PROJECT_NAME = "Magic-data";
const GITHUB_URL = "https://github.com/md2it/magic-data";
const GITHUB_ISSUES_URL = "https://github.com/md2it/magic-data/issues";

// ------------------------------------------------------------------
// Icons. Every icon in the UI comes from the one sprite
// (/assets/images/icons.svg) through this single helper, styled by the
// shared .icon class. See /documentation/developers/ui/imagery.
// ------------------------------------------------------------------

const ICON_SPRITE = "/assets/images/icons.svg";

function iconMarkup(name, modifier) {
    const className = modifier ? `icon ${modifier}` : "icon";
    return `<svg class="${className}" aria-hidden="true"><use href="${ICON_SPRITE}#${name}"></use></svg>`;
}

// Sets a control's content to an icon, optionally followed by a text label.
// The label is appended as a text node, so dynamic values (file names, keys)
// are never interpreted as HTML.
function setIconLabel(el, name, label) {
    el.innerHTML = iconMarkup(name);
    if (label != null && label !== "") el.append(" ", label);
}

window.AppIcons = { markup: iconMarkup, setLabel: setIconLabel };

let magicRunningCount = 0;

function confirmAppLifecycleAction(actionLabel) {
    return new Promise(function (resolve) {
        const backdrop = document.createElement("div");
        backdrop.className = "app-confirm-backdrop";
        const modal = document.createElement("div");
        modal.className = "app-confirm";
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        modal.setAttribute("aria-labelledby", "app-confirm-title");

        const header = document.createElement("div");
        header.className = "app-confirm__header";
        header.id = "app-confirm-title";
        header.textContent = actionLabel + "?";

        const body = document.createElement("p");
        body.className = "app-confirm__body";
        body.textContent = "There are running Magic AI processes. Even briefly stopping the server will interrupt them.";

        const footer = document.createElement("div");
        footer.className = "app-confirm__footer";
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "app-confirm__button";
        cancel.textContent = "Cancel";
        const proceed = document.createElement("button");
        proceed.type = "button";
        proceed.className = "app-confirm__button app-confirm__button--primary";
        proceed.textContent = "Proceed";

        function close(result) {
            document.removeEventListener("keydown", onKeydown);
            backdrop.remove();
            resolve(result);
        }
        function onKeydown(event) {
            if (event.key === "Escape") close(false);
        }
        cancel.addEventListener("click", function () { close(false); });
        proceed.addEventListener("click", function () { close(true); });
        backdrop.addEventListener("click", function (event) {
            if (event.target === backdrop) close(false);
        });
        document.addEventListener("keydown", onKeydown);

        footer.append(cancel, proceed);
        modal.append(header, body, footer);
        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);
        cancel.focus();
    });
}

async function hasRunningMagicProcesses() {
    try {
        const response = await fetch("/api/magic-log?limit=0", { cache: "no-store" });
        if (!response.ok) return magicRunningCount > 0;
        const counts = (await response.json()).counts;
        const running = ((counts && counts.current) || {}).running || 0;
        magicRunningCount = running;
        renderMagicLogCounters(counts);
        return running > 0;
    } catch (error) {
        return magicRunningCount > 0;
    }
}

async function confirmIfMagicRunning(actionLabel) {
    if (!(await hasRunningMagicProcesses())) return true;
    return confirmAppLifecycleAction(actionLabel);
}

function stopApp() {
    fetch("/stop", { method: "POST" }).then(function () {
        const status = document.getElementById("status");
        if (status) status.textContent = "Server stopped.";
        setTimeout(function () {
            window.location.reload();
        }, 300);
    });
}

function restartApp(button) {
    button.disabled = true;
    button.textContent = "Restarting…";
    fetch("/restart", { method: "POST" });
}

function renderHeader() {
    const header = document.getElementById("app-header");
    if (!header) return;

    header.className = "app-header";
    header.innerHTML = `
        <a class="app-header__title" href="/">${PROJECT_NAME}</a>
        <nav class="app-header__nav" aria-label="Main navigation">
            <a href="/data">Data</a>
            <a class="app-header__magic-log" href="/magic-log">Magic log <span class="app-header__magic-counts" aria-label="Current Magic runs"></span></a>
            <a href="/documentation">Documentation</a>
            <a href="/settings">Settings</a>
        </nav>
        <div class="app-header__actions">
            <button id="restart-btn" type="button">Restart app</button>
            <button id="stop-btn" type="button">Stop app</button>
        </div>
    `;

    header.querySelector("#stop-btn").addEventListener("click", async function () {
        if (!(await confirmIfMagicRunning("Stop app"))) return;
        stopApp();
    });

    header.querySelector("#restart-btn").addEventListener("click", async function (event) {
        const button = event.currentTarget;
        if (!(await confirmIfMagicRunning("Restart app"))) return;
        restartApp(button);
    });
}

function renderMagicLogCounters(counts) {
    const element = document.querySelector(".app-header__magic-counts");
    if (!element) return;
    const values = (counts && counts.current) || {};
    magicRunningCount = values.running || 0;
    const parts = [["running", magicRunningCount, "In progress"], ["success", values.success || 0, "Successful"], ["failed", values.failed || 0, "Unsuccessful"]].map(function (item) {
        return `<span class="app-header__magic-count app-header__magic-count--${item[0]}" title="${item[2]}: ${item[1]}">${item[1]}</span>`;
    });
    element.innerHTML = `( ${parts.join(" | ")} )`;
}

async function refreshMagicLogCounters() {
    try {
        const response = await fetch("/api/magic-log?limit=0", { cache: "no-store" });
        if (response.ok) renderMagicLogCounters((await response.json()).counts);
    } catch (error) { /* The local server may be stopping. */ }
}

function renderFooter() {
    const footer = document.getElementById("app-footer");
    if (!footer) return;

    footer.className = "app-footer";
    footer.innerHTML = `
        <span>${PROJECT_NAME}</span>
        <a href="${GITHUB_URL}" target="_blank" rel="noopener noreferrer">GitHub</a>
        <a href="${GITHUB_ISSUES_URL}" target="_blank" rel="noopener noreferrer">Report issue</a>
    `;
}

function renderPrintFooter() {
    const printFooter = document.getElementById("print-footer");
    if (!printFooter) return;

    printFooter.innerHTML = `${PROJECT_NAME} — <a href="${GITHUB_URL}">${GITHUB_URL}</a>`;
}

document.addEventListener("DOMContentLoaded", function () {
    renderHeader();
    refreshMagicLogCounters();
    window.addEventListener("magic-log-updated", refreshMagicLogCounters);
    setInterval(refreshMagicLogCounters, 3000);
    renderFooter();
    renderPrintFooter();
});
