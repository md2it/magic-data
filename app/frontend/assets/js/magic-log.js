(function () {
    const PAGE_SIZE = 50;
    let offset = 0;
    let total = 0;
    let loading = false;

    function counter(scope, kind, value) {
        const label = { running: "in progress", success: "successful", failed: "unsuccessful", cancelled: "canceled" }[kind];
        const archived = scope === "Archived" ? " magic-log-count--archived" : "";
        return `<span class="magic-log-count magic-log-count--${kind}${archived}">${label}: ${value}</span>`;
    }

    function formatDate(value) { return value ? new Date(value).toLocaleString() : "—"; }
    function statusLabel(status) { return { running: "In progress", done: "Successful", failed: "Unsuccessful", cancelled: "Canceled" }[status] || status; }
    function documentUrl(path) {
        const parts = path.split("/");
        parts[parts.length - 1] = parts[parts.length - 1].replace(/\.json$/i, "");
        return `/data/${parts.map(encodeURIComponent).join("/")}`;
    }

    function collapseCancel(button) {
        button.classList.remove("is-confirming");
        button.setAttribute("aria-label", "Cancel run");
        button.setAttribute("aria-expanded", "false");
    }

    async function waitUntilSettled(runId) {
        for (let attempt = 0; attempt < 40; attempt += 1) {
            await new Promise(function (resolve) { setTimeout(resolve, 250); });
            try {
                const response = await fetch(`/api/llm/runs/${encodeURIComponent(runId)}`, { cache: "no-store" });
                if (!response.ok) return;
                const data = await response.json();
                if (!data.run || data.run.status !== "running") return;
            } catch (error) {
                return;
            }
        }
    }

    async function cancelRun(runId, button) {
        button.disabled = true;
        try {
            const response = await fetch(`/api/llm/runs/${encodeURIComponent(runId)}/cancel`, {
                method: "POST",
                cache: "no-store",
            });
            if (response.ok) await waitUntilSettled(runId);
        } finally {
            window.dispatchEvent(new Event("magic-log-updated"));
            await load(true);
        }
    }

    function buildCancelControl(run) {
        const slot = document.createElement("span");
        slot.className = "magic-log-cancel-slot";
        const button = document.createElement("button");
        button.type = "button";
        button.className = "magic-log-cancel";
        button.setAttribute("aria-label", "Cancel run");
        button.setAttribute("aria-expanded", "false");
        button.innerHTML = window.AppIcons.markup("ban", "icon--sm") + '<span class="magic-log-cancel__label">Cancel it?</span>';
        button.addEventListener("mouseleave", function () {
            if (!button.disabled) collapseCancel(button);
        });
        button.addEventListener("click", function () {
            if (button.disabled) return;
            if (!button.classList.contains("is-confirming")) {
                button.classList.add("is-confirming");
                button.setAttribute("aria-label", "Cancel it?");
                button.setAttribute("aria-expanded", "true");
                return;
            }
            cancelRun(run.id, button);
        });
        slot.appendChild(button);
        return slot;
    }

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
            ["Document", run.documentPath],
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
            const documentCell = document.createElement("td");
            if (run.documentPath) {
                const link = document.createElement("a");
                link.href = documentUrl(run.documentPath);
                link.textContent = run.documentPath;
                documentCell.appendChild(link);
            } else {
                documentCell.textContent = "—";
            }
            const scope = document.createElement("td");
            scope.textContent = run.scope === "archived" ? "Archived" : "Current";
            const action = document.createElement("td");
            action.className = "magic-log-actions";
            const actions = document.createElement("div");
            actions.className = "magic-log-actions__row";
            if (run.status === "running" && run.scope === "current" && run.id) {
                actions.appendChild(buildCancelControl(run));
            }
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
            detailsCell.colSpan = 7;
            detailsCell.appendChild(buildDetails(run));
            detailsRow.appendChild(detailsCell);
            button.addEventListener("click", function () {
                const expanded = button.getAttribute("aria-expanded") === "true";
                button.setAttribute("aria-expanded", String(!expanded));
                button.setAttribute("aria-label", expanded ? "Show run details" : "Hide run details");
                detailsRow.hidden = expanded;
            });
            actions.appendChild(button);
            action.appendChild(actions);
            row.append(status, title, started, provider, documentCell, scope, action);
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
            ["running", "success", "failed", "cancelled"].forEach(function (kind) {
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
            if (offset === 0) list.innerHTML = '<tr><td class="magic-log-empty" colspan="7">No Magic runs yet.</td></tr>';
            document.querySelector("[data-log-total]").textContent = `${total} total`;
            document.querySelector("[data-load-more]").hidden = offset >= total;
        } catch (error) {
            list.innerHTML = '<tr><td class="magic-log-empty" colspan="7">Magic log is unavailable.</td></tr>';
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
        load(true);
    });
})();
