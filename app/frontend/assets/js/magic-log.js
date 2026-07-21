(function () {
    const PAGE_SIZE = 50;
    let offset = 0;
    let total = 0;
    let loading = false;

    function counter(scope, kind, value) {
        const label = { running: "in progress", success: "successful", failed: "unsuccessful" }[kind];
        return `<span class="magic-log-count magic-log-count--${kind}">${scope} ${label}: ${value}</span>`;
    }

    function formatDate(value) { return value ? new Date(value).toLocaleString() : "—"; }
    function statusLabel(status) { return { running: "In progress", done: "Successful", failed: "Unsuccessful", cancelled: "Stopped" }[status] || status; }

    function appendRuns(runs) {
        const list = document.querySelector("[data-log-list]");
        runs.forEach(function (run) {
            const row = document.createElement("tr");
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
            row.append(status, title, started, provider, scope);
            list.appendChild(row);
        });
    }

    function renderCounts(counts) {
        const element = document.querySelector("[data-log-counts]");
        const fragments = [];
        ["current", "archived"].forEach(function (scope) {
            const values = counts[scope] || {};
            const label = scope === "current" ? "Current" : "Archived";
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
            if (offset === 0) list.innerHTML = '<tr><td class="magic-log-empty" colspan="5">No Magic runs yet.</td></tr>';
            document.querySelector("[data-log-total]").textContent = `${total} total`;
            document.querySelector("[data-load-more]").hidden = offset >= total;
        } catch (error) {
            list.innerHTML = '<tr><td class="magic-log-empty" colspan="5">Magic log is unavailable.</td></tr>';
        } finally {
            loading = false;
        }
    }

    document.addEventListener("DOMContentLoaded", function () {
        document.querySelector("[data-load-more]").addEventListener("click", function () { load(false); });
        window.addEventListener("magic-log-updated", function () { load(true); });
        load(true);
    });
})();
