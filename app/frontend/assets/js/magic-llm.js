/*
 * Magic-data LLM adapter.
 *
 * Exposes window.magicLlm.runScenario(scenarioId, options). A scenario is
 * configured on the backend (app/llm-scenarios/*.yaml). Options let a single
 * call customize the run: { provider, context, extra, button, loadingLabel }.
 *
 * The user just clicks a button — the adapter fetches the scenario, runs it
 * through a local CLI and shows the result in a small modal. It never reveals
 * that a terminal or CLI was involved.
 */
(function () {
    const READY = { styles: false };

    function ensureStyles() {
        if (READY.styles || document.getElementById("magic-llm-styles")) {
            READY.styles = true;
            return;
        }
        READY.styles = true;
        const style = document.createElement("style");
        style.id = "magic-llm-styles";
        style.textContent = `
.magic-llm-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: grid;
    place-items: center;
    background: rgba(0, 0, 0, .36);
    padding: 16px;
}
.magic-llm-modal {
    width: min(560px, 100%);
    max-height: calc(100vh - 48px);
    display: flex;
    flex-direction: column;
    border-radius: 10px;
    background: #fff;
    color: #1f2328;
    box-shadow: 0 20px 60px rgba(0, 0, 0, .28);
    overflow: hidden;
}
.magic-llm-modal__header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px 20px;
    border-bottom: 1px solid #d0d7de;
    font-weight: 600;
}
.magic-llm-modal__header--error { color: #b42318; }
.magic-llm-modal__body {
    padding: 20px;
    margin: 0;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
    font: inherit;
    line-height: 1.5;
}
.magic-llm-modal__footer {
    display: flex;
    justify-content: flex-end;
    padding: 0 20px 20px;
}
.magic-llm-modal__ok {
    padding: 8px 18px;
    border: 1px solid #d0d7de;
    border-radius: 6px;
    background: #f6f8fa;
    color: #1f2328;
    cursor: pointer;
    font: inherit;
}
.magic-llm-modal__ok:hover { background: #eaeef2; }
.magic-llm-modal__ok--primary {
    border-color: #1f6feb;
    background: #1f6feb;
    color: #fff;
}
.magic-llm-modal__ok--primary:hover { background: #1a5fd0; }
.magic-llm-modal__footer--split { justify-content: flex-end; gap: 8px; }
.magic-llm-form .magic-llm-modal__footer { padding: 4px 0 8px; }
.magic-llm-form {
    padding: 4px 20px 8px;
    display: flex;
    flex-direction: column;
    gap: 14px;
}
.magic-llm-field { display: flex; flex-direction: column; gap: 4px; }
.magic-llm-field > span { font-size: 0.85rem; color: #57606a; }
.magic-llm-field input[type="text"],
.magic-llm-field textarea {
    padding: 8px 10px;
    border: 1px solid #d0d7de;
    border-radius: 6px;
    font: inherit;
}
.magic-llm-field textarea { resize: vertical; min-height: 76px; }
.magic-llm-prompt {
    border: 1px solid #d0d7de;
    border-radius: 6px;
    background: #f6f8fa;
}
.magic-llm-prompt__summary {
    padding: 7px 10px;
    cursor: pointer;
    font-size: 0.85rem;
    color: #57606a;
    user-select: none;
    list-style-position: inside;
}
.magic-llm-prompt__summary:hover { color: #1f2328; }
.magic-llm-prompt__text {
    margin: 0;
    padding: 10px;
    border-top: 1px solid #d0d7de;
    max-height: 220px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
    font-size: 0.78rem;
    line-height: 1.45;
    color: #24292f;
}
.magic-llm-field--toggle {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}
.magic-llm-field--toggle > span { font-size: 0.9rem; color: #1f2328; }
.magic-llm-switch {
    appearance: none;
    -webkit-appearance: none;
    width: 34px;
    height: 20px;
    flex-shrink: 0;
    border-radius: 999px;
    background: #d0d7de;
    position: relative;
    cursor: pointer;
    outline: none;
    transition: background .15s ease;
}
.magic-llm-switch::before {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    transition: left .15s ease;
}
.magic-llm-switch:checked { background: #1f2328; }
.magic-llm-switch:checked::before { left: 16px; }
.magic-inline-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #d0d7de;
    background: #fff;
    color: #57606a;
    border-radius: 5px;
    cursor: pointer;
    font: inherit;
    line-height: 1;
    padding: 2px 5px;
    font-size: 0.8em;
    vertical-align: -0.25em;
}
.magic-inline-btn:hover { background: #f6f8fa; color: #1f2328; }
.magic-inline-btn:disabled { opacity: .6; cursor: wait; }
.magic-runs {
    position: fixed;
    left: 16px;
    bottom: 16px;
    z-index: 900;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    font: inherit;
}
.magic-runs__pill {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 6px 12px;
    border: 1px solid #d0d7de;
    border-radius: 999px;
    background: #fff;
    color: #1f2328;
    box-shadow: 0 6px 20px rgba(0, 0, 0, .16);
    cursor: pointer;
    font-size: 0.85rem;
}
.magic-runs__count { display: inline-flex; align-items: center; gap: 5px; }
.magic-runs__count::before {
    content: "";
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
}
.magic-runs__count--running { color: #1f6feb; }
.magic-runs__count--done { color: #1a7f37; }
.magic-runs__count--failed { color: #cf222e; }
.magic-runs__count--muted { opacity: .45; }
.magic-runs__panel {
    width: min(360px, calc(100vw - 32px));
    max-height: min(60vh, 460px);
    overflow-y: auto;
    border: 1px solid #d0d7de;
    border-radius: 10px;
    background: #fff;
    box-shadow: 0 12px 40px rgba(0, 0, 0, .2);
    padding: 6px;
    display: none;
}
.magic-runs.is-open .magic-runs__panel { display: block; }
.magic-runs__row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border-radius: 7px;
}
.magic-runs__row + .magic-runs__row { border-top: 1px solid #eaeef2; }
.magic-runs__section {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    padding: 9px 8px 4px;
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: #8c959f;
}
.magic-runs__section--running { color: #1f6feb; }
.magic-runs__section--done { color: #1a7f37; }
.magic-runs__section--failed { color: #cf222e; }
.magic-runs__section--cancelled { color: #8c959f; }
.magic-runs__section-count { font-variant-numeric: tabular-nums; opacity: .75; }
.magic-runs__empty {
    padding: 16px 10px;
    text-align: center;
    font-size: 0.8rem;
    color: #8c959f;
}
.magic-runs__dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; background: #8c959f; }
.magic-runs__dot--running { background: #1f6feb; }
.magic-runs__dot--done { background: #1a7f37; }
.magic-runs__dot--failed { background: #cf222e; }
.magic-runs__body { flex: 1; min-width: 0; }
.magic-runs__label { font-size: 0.85rem; color: #1f2328; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.magic-runs__meta { font-size: 0.75rem; color: #57606a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.magic-runs__row-btn {
    border: 1px solid #d0d7de;
    background: #f6f8fa;
    color: #1f2328;
    border-radius: 6px;
    cursor: pointer;
    font: inherit;
    font-size: 0.78rem;
    padding: 3px 8px;
    flex-shrink: 0;
}
.magic-runs__row-btn:hover { background: #eaeef2; }
.magic-runs__row-btn--stop { border-color: #f0b3b3; color: #cf222e; }
.magic-runs__row-btn--dismiss { padding: 3px 7px; color: #57606a; }
@keyframes magic-llm-spin { to { transform: rotate(360deg); } }
.magic-llm-spinner {
    display: inline-block;
    width: 13px;
    height: 13px;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: magic-llm-spin .7s linear infinite;
    vertical-align: -1px;
}`;
        document.head.appendChild(style);
    }

    function showModal(title, message, isError) {
        ensureStyles();
        const backdrop = document.createElement("div");
        backdrop.className = "magic-llm-modal-backdrop";
        const modal = document.createElement("div");
        modal.className = "magic-llm-modal";
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");

        const header = document.createElement("div");
        header.className = "magic-llm-modal__header" + (isError ? " magic-llm-modal__header--error" : "");
        header.textContent = title;

        const body = document.createElement("div");
        body.className = "magic-llm-modal__body";
        body.textContent = message;

        const footer = document.createElement("div");
        footer.className = "magic-llm-modal__footer";
        const ok = document.createElement("button");
        ok.type = "button";
        ok.className = "magic-llm-modal__ok";
        ok.textContent = "OK";

        function close() {
            document.removeEventListener("keydown", onKeydown);
            backdrop.remove();
        }
        function onKeydown(event) {
            if (event.key === "Escape") close();
        }
        ok.addEventListener("click", close);
        backdrop.addEventListener("click", function (event) {
            if (event.target === backdrop) close();
        });
        document.addEventListener("keydown", onKeydown);

        footer.appendChild(ok);
        modal.append(header, body, footer);
        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);
        ok.focus();
    }

    async function fetchScenario(scenarioId) {
        const response = await fetch(`/api/llm-scenarios/${encodeURIComponent(scenarioId)}`, {
            method: "GET",
            cache: "no-store",
        });
        if (!response.ok) return null;
        return response.json().catch(() => null);
    }

    // A scenario may declare optional parameters as a { name: spec } map. A
    // spec is either a plain label string (a text field) or an object
    // { type, label, placeholder, default } where type is text | textarea |
    // toggle. Returns a normalized field list, or [] when none are declared.
    const FIELD_TYPES = ["text", "textarea", "toggle"];

    function declaredParams(scenario) {
        const params = scenario && scenario.params;
        if (!params || typeof params !== "object") return [];
        return Object.keys(params).map(function (name) {
            const spec = params[name];
            if (spec && typeof spec === "object") {
                return {
                    name: name,
                    type: FIELD_TYPES.indexOf(spec.type) !== -1 ? spec.type : "text",
                    label: spec.label != null ? String(spec.label) : name,
                    placeholder: spec.placeholder != null ? String(spec.placeholder) : "",
                    default: spec.default,
                };
            }
            return { name: name, type: "text", label: String(spec || name), placeholder: "", default: "" };
        });
    }

    function buildField(field, controls) {
        const wrap = document.createElement("label");
        wrap.className = "magic-llm-field";
        const caption = document.createElement("span");
        caption.textContent = field.label;

        if (field.type === "toggle") {
            wrap.classList.add("magic-llm-field--toggle");
            const input = document.createElement("input");
            input.type = "checkbox";
            input.className = "magic-llm-switch";
            input.checked = Boolean(field.default);
            wrap.append(caption, input);
            controls[field.name] = { input: input, type: "toggle" };
            return wrap;
        }

        const input = field.type === "textarea"
            ? document.createElement("textarea")
            : document.createElement("input");
        if (field.type !== "textarea") input.type = "text";
        else input.rows = 7; // taller by default; still user-resizable (CSS resize: vertical)
        if (field.placeholder) input.placeholder = field.placeholder;
        if (field.default != null) input.value = String(field.default);
        input.name = field.name;
        wrap.append(caption, input);
        controls[field.name] = { input: input, type: field.type };
        return wrap;
    }

    // Collapsible, read-only view of the scenario's base prompt. Collapsed by
    // default so the modal stays focused on the fields the user fills in, but
    // available for anyone who wants to see exactly what will be run. The raw
    // template (with its {{placeholders}}) is shown — that IS the base prompt.
    function buildPromptDisclosure(promptText) {
        const details = document.createElement("details");
        details.className = "magic-llm-prompt";
        const summary = document.createElement("summary");
        summary.className = "magic-llm-prompt__summary";
        summary.textContent = "Base prompt";
        const pre = document.createElement("pre");
        pre.className = "magic-llm-prompt__text";
        pre.textContent = String(promptText).trim();
        details.append(summary, pre);
        return details;
    }

    // Show a small form for the declared optional parameters. Resolves with a
    // { name: value } object, or null if the user cancelled. When a base prompt
    // is given, a collapsed disclosure of it is shown above the fields.
    function collectParams(title, fields, promptText) {
        ensureStyles();
        return new Promise(function (resolve) {
            const backdrop = document.createElement("div");
            backdrop.className = "magic-llm-modal-backdrop";
            const modal = document.createElement("div");
            modal.className = "magic-llm-modal";
            modal.setAttribute("role", "dialog");
            modal.setAttribute("aria-modal", "true");

            const header = document.createElement("div");
            header.className = "magic-llm-modal__header";
            header.textContent = title;

            const form = document.createElement("form");
            form.className = "magic-llm-form";
            if (promptText && String(promptText).trim()) {
                form.appendChild(buildPromptDisclosure(promptText));
            }
            const controls = {};
            fields.forEach(function (field) {
                form.appendChild(buildField(field, controls));
            });

            const footer = document.createElement("div");
            footer.className = "magic-llm-modal__footer magic-llm-modal__footer--split";
            const cancel = document.createElement("button");
            cancel.type = "button";
            cancel.className = "magic-llm-modal__ok";
            cancel.textContent = "Cancel";
            const run = document.createElement("button");
            run.type = "submit";
            run.className = "magic-llm-modal__ok magic-llm-modal__ok--primary";
            run.textContent = "Run";

            function close(result) {
                document.removeEventListener("keydown", onKeydown);
                backdrop.remove();
                resolve(result);
            }
            function onKeydown(event) {
                if (event.key === "Escape") close(null);
            }
            cancel.addEventListener("click", function () { close(null); });
            backdrop.addEventListener("click", function (event) {
                if (event.target === backdrop) close(null);
            });
            form.addEventListener("submit", function (event) {
                event.preventDefault();
                const values = {};
                Object.keys(controls).forEach(function (name) {
                    const control = controls[name];
                    values[name] = control.type === "toggle"
                        ? control.input.checked
                        : control.input.value.trim();
                });
                close(values);
            });
            document.addEventListener("keydown", onKeydown);

            footer.append(cancel, run);
            form.appendChild(footer);
            modal.append(header, form);
            backdrop.appendChild(modal);
            document.body.appendChild(backdrop);
            const firstText = fields.find(function (field) { return field.type !== "toggle"; });
            if (firstText) controls[firstText.name].input.focus();
        });
    }

    function setButtonLoading(button, label) {
        if (!button) return function () {};
        const original = button.innerHTML;
        const wasDisabled = button.disabled;
        button.disabled = true;
        button.innerHTML = `<span class="magic-llm-spinner" aria-hidden="true"></span> ${label}`;
        return function restore() {
            button.disabled = wasDisabled;
            button.innerHTML = original;
        };
    }

    // ------------------------------------------------------------------
    // Run store + global status widget
    //
    // Runs are async and tracked server-side (the registry). This store polls
    // /api/llm/runs while anything is active, mirrors every run into a
    // bottom-left widget with aggregate counters, and lets any waiter resolve
    // when its run reaches a terminal state. Because the registry is global,
    // the widget shows all runs from every page/tab, and a finished run's
    // result stays retrievable even after leaving the page that started it.
    // ------------------------------------------------------------------
    const RunStore = (function () {
        const runs = new Map();       // id -> run object (server shape)
        const waiters = new Map();    // id -> [resolve fns]
        const dismissed = new Set();  // ids hidden locally
        let polling = false;
        let pollTimer = null;
        let container = null;
        let pill = null;
        let panel = null;
        let open = false;

        function isTerminal(run) { return run && run.status && run.status !== "running"; }

        function anyRunning() {
            for (const run of runs.values()) if (run.status === "running") return true;
            return false;
        }

        function visibleRuns() {
            return Array.from(runs.values())
                .filter(function (run) { return !dismissed.has(run.id); })
                .sort(function (a, b) { return (b.startedAt || 0) - (a.startedAt || 0); });
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
                // transient — try again on the next tick
            }
            render();
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

        function add(run) {
            runs.set(run.id, run);
            render();
            ensurePolling();
        }

        function waitFor(id) {
            return new Promise(function (resolve) {
                const run = runs.get(id);
                if (isTerminal(run)) { resolve(run); return; }
                if (!waiters.has(id)) waiters.set(id, []);
                waiters.get(id).push(resolve);
                ensurePolling();
            });
        }

        async function cancel(id) {
            try {
                await fetch(`/api/llm/runs/${encodeURIComponent(id)}/cancel`, {
                    method: "POST",
                    cache: "no-store",
                });
            } catch (error) {
                // ignore; the next poll reflects the real state
            }
            ensurePolling();
        }

        function elapsed(run) {
            const end = run.status === "running" ? Date.now() : (run.finishedAt || Date.now());
            const seconds = Math.max(0, Math.round((end - (run.startedAt || end)) / 1000));
            if (seconds < 60) return `${seconds}s`;
            return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
        }

        function ensureWidget() {
            if (container || !document.body) return;
            ensureStyles(); // the widget is always visible, even before any modal
            container = document.createElement("div");
            container.className = "magic-runs";
            pill = document.createElement("button");
            pill.type = "button";
            pill.className = "magic-runs__pill";
            pill.addEventListener("click", function () {
                open = !open;
                container.classList.toggle("is-open", open);
                render();
            });
            panel = document.createElement("div");
            panel.className = "magic-runs__panel";
            container.append(panel, pill);
            document.body.appendChild(container);
        }

        // Status groups shown, in this order, as titled sections when the panel
        // is open. Only groups with at least one visible run get a header. Titles
        // are uppercased by CSS ("Magic in progress" -> "MAGIC IN PROGRESS").
        const GROUPS = [
            { key: "running", title: "Magic in progress" },
            { key: "done", title: "Magic done" },
            { key: "failed", title: "Magic failed" },
            { key: "cancelled", title: "Magic stopped" }
        ];

        function render() {
            ensureWidget();
            if (!container) return;
            const list = visibleRuns();

            // The counter is a permanent fixture — always visible, even with no
            // runs (it just reads 0). Dismissing individual runs, or clearing a
            // whole status group, never removes the counter itself; only the
            // expandable panel's contents come and go.
            let running = 0, done = 0, failed = 0;
            list.forEach(function (run) {
                if (run.status === "running") running++;
                else if (run.status === "done") done++;
                else if (run.status === "failed") failed++;
            });
            pill.innerHTML = "";
            pill.append(
                counter("running", running),
                counter("done", done),
                counter("failed", failed)
            );

            if (!open) { panel.innerHTML = ""; return; }
            panel.innerHTML = "";
            let shown = 0;
            GROUPS.forEach(function (group) {
                const items = list.filter(function (run) { return run.status === group.key; });
                if (items.length === 0) return;
                shown += items.length;
                panel.appendChild(sectionHeader(group, items.length));
                items.forEach(function (run) { panel.appendChild(buildRow(run)); });
            });
            if (shown === 0) {
                const empty = document.createElement("div");
                empty.className = "magic-runs__empty";
                empty.textContent = "No magic runs yet.";
                panel.appendChild(empty);
            }
        }

        function sectionHeader(group, count) {
            const header = document.createElement("div");
            header.className = "magic-runs__section magic-runs__section--" + group.key;
            const title = document.createElement("span");
            title.textContent = group.title;
            const badge = document.createElement("span");
            badge.className = "magic-runs__section-count";
            badge.textContent = String(count);
            header.append(title, badge);
            return header;
        }

        function counter(kind, value) {
            const span = document.createElement("span");
            span.className = `magic-runs__count magic-runs__count--${kind}` + (value ? "" : " magic-runs__count--muted");
            span.textContent = `${value}`;
            span.title = `${value} ${kind}`;
            return span;
        }

        function buildRow(run) {
            const row = document.createElement("div");
            row.className = "magic-runs__row";

            const dot = document.createElement("span");
            dot.className = "magic-runs__dot magic-runs__dot--" + run.status;
            row.appendChild(dot);

            const body = document.createElement("div");
            body.className = "magic-runs__body";
            const label = document.createElement("div");
            label.className = "magic-runs__label";
            label.textContent = run.label || run.scenarioId;
            const meta = document.createElement("div");
            meta.className = "magic-runs__meta";
            const via = run.profile || run.provider || run.selector || "";
            const where = run.contextLabel ? ` · ${run.contextLabel}` : "";
            meta.textContent = `${run.status} · ${elapsed(run)}${via ? ` · ${via}` : ""}${where}`;
            body.append(label, meta);
            row.appendChild(body);

            if (run.status === "running") {
                row.appendChild(rowButton("Stop", "stop", function () { cancel(run.id); }));
            } else {
                row.appendChild(rowButton("View", "", function () {
                    const isError = run.status === "failed";
                    const text = run.status === "cancelled"
                        ? (run.error || "Stopped by user")
                        : (isError ? (run.error || "The run failed.") : (run.text || "Empty response."));
                    showModal(run.label || run.scenarioId, text, isError);
                }));
                const dismiss = rowButton("", "dismiss", function () {
                    dismissed.add(run.id);
                    render();
                });
                dismiss.setAttribute("aria-label", "Dismiss");
                dismiss.innerHTML = window.AppIcons.markup("x", "icon--sm");
                row.appendChild(dismiss);
            }
            return row;
        }

        function rowButton(text, variant, onClick) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "magic-runs__row-btn" + (variant ? ` magic-runs__row-btn--${variant}` : "");
            button.textContent = text;
            button.addEventListener("click", onClick);
            return button;
        }

        function init() {
            if (document.body) { ensureWidget(); ensurePolling(); }
            else document.addEventListener("DOMContentLoaded", function () { ensureWidget(); ensurePolling(); });
        }

        return { add: add, waitFor: waitFor, init: init };
    })();

    async function runScenario(scenarioId, options) {
        options = options || {};
        const button = options.button || null;
        const scenario = await fetchScenario(scenarioId).catch(() => null);
        const title = (scenario && scenario.ui && scenario.ui.label) || scenarioId;
        const loadingLabel =
            options.loadingLabel ||
            (scenario && scenario.ui && scenario.ui.loadingLabel) ||
            "Running...";

        // Optional parameters (Level 2): ask the user only when the scenario
        // declares them and the caller did not already supply them.
        let params = options.params || null;
        if (!params && scenario) {
            const fields = declaredParams(scenario);
            if (fields.length > 0) {
                params = await collectParams(title, fields, scenario.prompt);
                if (params === null) return null; // cancelled
            }
        }

        // The context carries call-site info (e.g. the current document) plus
        // any collected optional parameters.
        const context = Object.assign({}, options.context || {});
        if (params) context.params = Object.assign({}, context.params, params);

        // Start the run asynchronously — this returns immediately with a run id,
        // so other buttons can start their own runs in parallel.
        let startData;
        try {
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
            startData = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(startData.error || `Request failed: ${response.status}`);
        } catch (error) {
            const message =
                error instanceof TypeError
                    ? "The local LLM engine is not reachable. Is the app still running?"
                    : error instanceof Error ? error.message : String(error);
            showModal(title, message, true);
            return null;
        }

        const run = startData.run;
        if (!run || !run.id) { showModal(title, "The run could not be created.", true); return null; }
        RunStore.add(run);

        // Mirror this run's progress on the source button, and surface its
        // result here when it finishes (the widget keeps it too).
        const restore = setButtonLoading(button, loadingLabel);
        const finalRun = await RunStore.waitFor(run.id);
        restore();

        if (finalRun.status === "done") {
            showModal(title, finalRun.text || "Empty response.", false);
            return finalRun;
        }
        if (finalRun.status === "cancelled") {
            return null; // the widget already reflects the cancellation
        }
        showModal(title, finalRun.error || "The run failed.", true);
        return null;
    }

    RunStore.init();
    window.magicLlm = { runScenario: runScenario, fetchScenario: fetchScenario };
})();
