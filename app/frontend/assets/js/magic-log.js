(function () {
    const PAGE_SIZE = 50;
    let offset = 0;
    let total = 0;
    let loading = false;

    function counter(scope, kind, value) {
        const label = { running: "in progress", success: "successful", failed: "unsuccessful" }[kind];
        const archived = scope === "Archived" ? " magic-log-count--archived" : "";
        return `<span class="magic-log-count magic-log-count--${kind}${archived}">${label}: ${value}</span>`;
    }

    function formatDate(value) { return value ? new Date(value).toLocaleString() : "—"; }
    function statusLabel(status) { return { running: "In progress", done: "Successful", failed: "Unsuccessful", cancelled: "Stopped" }[status] || status; }

    function detailItem(label, value) {
        const term = document.createElement("dt");
        term.textContent = label;
        const description = document.createElement("dd");
        description.textContent = value || "—";
        return [term, description];
    }

    function buildDetails(run) {
        const details = document.createElement("dl");
        details.className = "magic-log-details";
        [
            ["Scenario", run.scenarioId],
            ["Provider", run.profile || run.provider || run.selector],
            ["Started", formatDate(run.startedAt)],
            ["Finished", formatDate(run.finishedAt)],
            ["Session", run.scope === "archived" ? "Archived" : "Current"],
        ].forEach(function (item) { details.append(...detailItem(item[0], item[1])); });
        const result = run.error || run.text;
        if (result) {
            const term = document.createElement("dt");
            term.textContent = run.error ? "Error" : "Response";
            const description = document.createElement("dd");
            const text = document.createElement("pre");
            text.textContent = result;
            description.appendChild(text);
            details.append(term, description);
        }
        return details;
    }

    function appendRuns(runs) {
        const list = document.querySelector("[data-log-list]");
        runs.forEach(function (run) {
            const row = document.createElement("tr");
            if (run.scope === "archived") row.className = "magic-log-entry--archived";
            const status = document.createElement("td");
            status.className = `magic-log-status magic-log-status--${run.status}`;
            status.textContent = statusLabel(run.status);
            const title = document.createElement("td");
            title.textContent = run.label || run.scenarioId || "Magic run";
            const started = document.createElement("td");
            started.textContent = formatDate(run.startedAt);
            const provider = document.createElement("td");
            provider.textContent = run.profile || run.provider || run.selector || "—";
            const scope = document.createElement("td");
            scope.textContent = run.scope === "archived" ? "Archived" : "Current";
            const action = document.createElement("td");
            const button = document.createElement("button");
            button.type = "button";
            button.className = "magic-log-details-control";
            button.setAttribute("aria-label", "Show run details");
            button.setAttribute("aria-expanded", "false");
            button.innerHTML = window.AppIcons.markup("info", "icon--sm");
            const detailsRow = document.createElement("tr");
            detailsRow.className = "magic-log-details-row";
            if (run.scope === "archived") detailsRow.classList.add("magic-log-entry--archived");
            detailsRow.hidden = true;
            const detailsCell = document.createElement("td");
            detailsCell.colSpan = 6;
            detailsCell.appendChild(buildDetails(run));
            detailsRow.appendChild(detailsCell);
            button.addEventListener("click", function () {
                const expanded = button.getAttribute("aria-expanded") === "true";
                button.setAttribute("aria-expanded", String(!expanded));
                button.setAttribute("aria-label", expanded ? "Show run details" : "Hide run details");
                detailsRow.hidden = expanded;
            });
            action.appendChild(button);
            row.append(status, title, started, provider, scope, action);
            list.appendChild(row);
            list.appendChild(detailsRow);
        });
    }

    function renderCounts(counts) {
        const element = document.querySelector("[data-log-counts]");
        const fragments = [];
        ["current", "archived"].forEach(function (scope) {
            const values = counts[scope] || {};
            const label = scope === "current" ? "Current" : "Archived";
            const scopeClass = scope === "archived" ? " magic-log-counts__scope--archived" : "";
            fragments.push(`<span class="magic-log-counts__scope${scopeClass}">${label}</span>`);
            ["running", "success", "failed"].forEach(function (kind) {
                fragments.push(counter(label, kind, values[kind] || 0));
            });
        });
        element.innerHTML = fragments.join("");
    }

    async function load(reset) {
        if (loading) return;
        loading = true;
        const list = document.querySelector("[data-log-list]");
        if (reset) { offset = 0; list.innerHTML = ""; }
        try {
            const response = await fetch(`/api/magic-log?offset=${offset}&limit=${PAGE_SIZE}`, { cache: "no-store" });
            if (!response.ok) throw new Error();
            const data = await response.json();
            total = data.total || 0;
            renderCounts(data.counts || {});
            appendRuns(data.runs || []);
            offset += (data.runs || []).length;
            if (offset === 0) list.innerHTML = '<tr><td class="magic-log-empty" colspan="6">No Magic runs yet.</td></tr>';
            document.querySelector("[data-log-total]").textContent = `${total} total`;
            document.querySelector("[data-load-more]").hidden = offset >= total;
        } catch (error) {
            list.innerHTML = '<tr><td class="magic-log-empty" colspan="6">Magic log is unavailable.</td></tr>';
        } finally {
            loading = false;
        }
    }

    document.addEventListener("DOMContentLoaded", function () {
        document.querySelector("[data-load-more]").addEventListener("click", function () { load(false); });
        document.querySelectorAll(".magic-log-connection .magic-btn").forEach(function (button) {
            button.addEventListener("click", function () {
                if (!window.magicLlm) return;
                window.magicLlm.runScenario("connection-test", {
                    provider: button.getAttribute("data-provider"),
                    button: button,
                });
            });
        });
        window.addEventListener("magic-log-updated", function () { load(true); });
        load(true);
    });
})();
