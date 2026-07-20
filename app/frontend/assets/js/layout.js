const PROJECT_NAME = "Magic-data";
const GITHUB_URL = "https://github.com/md2it/magic-data";

function renderHeader() {
    const header = document.getElementById("app-header");
    if (!header) return;

    header.className = "app-header";
    header.innerHTML = `
        <p class="app-header__title">${PROJECT_NAME}</p>
        <nav class="app-header__nav" aria-label="Main navigation">
            <a href="/">Data</a>
            <a href="/settings">Settings</a>
            <a href="/documentation">Documentation</a>
        </nav>
        <div class="app-header__magic">
            <button type="button" class="magic-btn" data-provider="codex">✨ Check Codex</button>
            <button type="button" class="magic-btn" data-provider="claude">✨ Check Claude</button>
        </div>
        <button id="stop-btn" type="button">Stop</button>
    `;

    header.querySelectorAll(".magic-btn").forEach(function (button) {
        button.addEventListener("click", function () {
            if (!window.magicLlm) return;
            window.magicLlm.runScenario("connection-test", {
                provider: button.getAttribute("data-provider"),
                button: button,
            });
        });
    });

    header.querySelector("#stop-btn").addEventListener("click", function () {
        fetch("/stop", { method: "POST" }).then(function () {
            const status = document.getElementById("status");
            if (status) status.textContent = "Server stopped.";
        });
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
