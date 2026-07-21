const PROJECT_NAME = "Magic-data";
const GITHUB_URL = "https://github.com/md2it/magic-data";

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

function renderHeader() {
    const header = document.getElementById("app-header");
    if (!header) return;

    header.className = "app-header";
    header.innerHTML = `
        <p class="app-header__title">${PROJECT_NAME}</p>
        <nav class="app-header__nav" aria-label="Main navigation">
            <a href="/">Data</a>
            <a href="/documentation">Documentation</a>
            <a href="/settings">Settings</a>
        </nav>
        <div class="app-header__actions">
            <button id="restart-btn" type="button">Restart</button>
            <button id="stop-btn" type="button">Stop</button>
        </div>
    `;

    header.querySelector("#stop-btn").addEventListener("click", function () {
        fetch("/stop", { method: "POST" }).then(function () {
            const status = document.getElementById("status");
            if (status) status.textContent = "Server stopped.";
            setTimeout(function () {
                window.location.reload();
            }, 300);
        });
    });

    header.querySelector("#restart-btn").addEventListener("click", function (event) {
        const button = event.currentTarget;
        button.disabled = true;
        button.textContent = "Restarting…";
        fetch("/restart", { method: "POST" });
    });
}

function renderFooter() {
    const footer = document.getElementById("app-footer");
    if (!footer) return;

    footer.className = "app-footer";
    footer.innerHTML = `
        <span>${PROJECT_NAME}</span>
        <a href="${GITHUB_URL}" target="_blank" rel="noopener noreferrer">GitHub</a>
    `;
}

function renderPrintFooter() {
    const printFooter = document.getElementById("print-footer");
    if (!printFooter) return;

    printFooter.innerHTML = `${PROJECT_NAME} — <a href="${GITHUB_URL}">${GITHUB_URL}</a>`;
}

document.addEventListener("DOMContentLoaded", function () {
    renderHeader();
    renderFooter();
    renderPrintFooter();
});
