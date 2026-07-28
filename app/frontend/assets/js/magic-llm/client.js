export async function fetchScenario(scenarioId) {
    const response = await fetch(`/api/llm-scenarios/${encodeURIComponent(scenarioId)}`, {
        method: "GET",
        cache: "no-store",
    });
    if (!response.ok) return null;
    return response.json().catch(() => null);
}

async function startScenario(scenarioId, options, context) {
    const response = await fetch("/api/llm/run", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            scenarioId: scenarioId,
            provider: options.provider,
            context: context,
            extra: options.extra || "",
        }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || `Request failed: ${response.status}`);
    }
    return data;
}

const runs = new Map();
const waiters = new Map();
let polling = false;
let pollTimer = null;

function isTerminal(run) {
    return run && run.status && run.status !== "running";
}

function anyRunning() {
    for (const run of runs.values()) {
        if (run.status === "running") return true;
    }
    return false;
}

async function poll() {
    try {
        const response = await fetch("/api/llm/runs", { cache: "no-store" });
        const data = await response.json();
        const list = (data && data.runs) || [];
        const seen = new Set();

        list.forEach(function (run) {
            seen.add(run.id);
            runs.set(run.id, run);
            if (isTerminal(run) && waiters.has(run.id)) {
                waiters.get(run.id).forEach(function (resolve) { resolve(run); });
                waiters.delete(run.id);
            }
        });
        Array.from(runs.keys()).forEach(function (id) {
            if (!seen.has(id) && !waiters.has(id)) runs.delete(id);
        });
    } catch (error) {
        // Transient failure: retry while a run or waiter remains active.
    }

    window.dispatchEvent(new Event("magic-log-updated"));
    clearTimeout(pollTimer);
    if (anyRunning() || waiters.size > 0) {
        pollTimer = setTimeout(poll, 1200);
    } else {
        polling = false;
    }
}

function ensurePolling() {
    if (polling) return;
    polling = true;
    poll();
}

function waitForRun(id) {
    return new Promise(function (resolve) {
        const run = runs.get(id);
        if (isTerminal(run)) {
            resolve(run);
            return;
        }
        if (!waiters.has(id)) waiters.set(id, []);
        waiters.get(id).push(resolve);
        ensurePolling();
    });
}

export async function startAndWait(scenarioId, options, context) {
    const data = await startScenario(scenarioId, options, context);
    const run = data.run;
    if (!run || !run.id) return null;

    runs.set(run.id, run);
    window.dispatchEvent(new Event("magic-log-updated"));
    ensurePolling();
    return waitForRun(run.id);
}

if (document.body) ensurePolling();
else document.addEventListener("DOMContentLoaded", ensurePolling);
