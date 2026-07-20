function renderPrintFooter() {
    const printFooter = document.getElementById("print-footer");
    if (!printFooter) return;

    printFooter.innerHTML = `${PROJECT_NAME} — <a href="${GITHUB_URL}">${GITHUB_URL}</a>`;
}

    renderPrintFooter();
