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
.magic-llm-context { margin: 0; font-size: 0.85rem; color: #57606a; }
.magic-llm-context strong { color: #1f2328; }
.magic-llm-field input[type="text"],
.magic-llm-field textarea {
    padding: 8px 10px;
    border: 1px solid #d0d7de;
    border-radius: 6px;
    font: inherit;
}
.magic-llm-field textarea { resize: vertical; min-height: 57px; }
.magic-llm-field__control { position: relative; display: flex; }
.magic-llm-field__control > input,
.magic-llm-field__control > textarea { width: 100%; box-sizing: border-box; }
.magic-llm-placeholder {
    position: absolute;
    inset: 0;
    padding: 9px 11px;
    pointer-events: none;
    font: inherit;
    line-height: 1.45;
    color: #8c959f;
    overflow: hidden;
}
.magic-llm-placeholder__label { display: block; font-weight: 600; color: #57606a; }
.magic-llm-placeholder__hint,
.magic-llm-placeholder__eg { display: block; font-size: 0.92em; }
.magic-llm-placeholder__eg { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.magic-llm-field--invalid input[type="text"],
.magic-llm-field--invalid textarea { border-color: #cf222e; }
.magic-llm-form__error {
    margin: 0;
    padding: 8px 10px;
    border: 1px solid #f0b3b3;
    border-radius: 6px;
    background: #fff5f5;
    color: #b42318;
    font-size: 0.85rem;
}
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
                    hint: spec.hint != null ? String(spec.hint) : "",
                    examples: Array.isArray(spec.examples) ? spec.examples.map(String) : [],
                    default: spec.default,
                };
            }
            return { name: name, type: "text", label: String(spec || name), placeholder: "", hint: "", examples: [], default: "" };
        });
    }

    function buildField(field, controls) {
        const wrap = document.createElement("label");
        wrap.className = "magic-llm-field";

        if (field.type === "toggle") {
            wrap.classList.add("magic-llm-field--toggle");
            const caption = document.createElement("span");
            caption.textContent = field.label;
            const input = document.createElement("input");
            input.type = "checkbox";
            input.className = "magic-llm-switch";
            input.checked = Boolean(field.default);
            wrap.append(caption, input);
            controls[field.name] = { input: input, type: "toggle" };
            return wrap;
        }

        // The field NAME is shown inside the field as a custom placeholder
        // overlay: a bold label on the first line, followed by lighter hint and
        // example lines. It hides on focus or when the field holds a value.
        // Native placeholder can't be bold or multi-line, hence the overlay.
        const control = document.createElement("div");
        control.className = "magic-llm-field__control";

        const input = field.type === "textarea"
            ? document.createElement("textarea")
            : document.createElement("input");
        if (field.type !== "textarea") input.type = "text";
        else input.rows = 6; // taller by default; still user-resizable (CSS resize: vertical)
        if (field.default != null) input.value = String(field.default);
        input.name = field.name;
        input.setAttribute("aria-label", field.label); // no visible <label> text now

        const overlay = document.createElement("div");
        overlay.className = "magic-llm-placeholder";
        overlay.setAttribute("aria-hidden", "true");
        const strong = document.createElement("span");
        strong.className = "magic-llm-placeholder__label";
        strong.textContent = field.label;
        overlay.appendChild(strong);
        if (field.hint) {
            const hint = document.createElement("span");
            hint.className = "magic-llm-placeholder__hint";
            hint.textContent = field.hint;
            overlay.appendChild(hint);
        }
        (field.examples || []).forEach(function (example) {
            const eg = document.createElement("span");
            eg.className = "magic-llm-placeholder__eg";
            eg.textContent = example;
            overlay.appendChild(eg);
        });

        function syncOverlay() {
            overlay.style.display = input.value.trim() === "" ? "" : "none";
        }
        input.addEventListener("focus", function () { overlay.style.display = "none"; });
        input.addEventListener("blur", syncOverlay);
        input.addEventListener("input", syncOverlay);
        syncOverlay();

        control.append(input, overlay);
        wrap.appendChild(control);
        controls[field.name] = { input: input, type: field.type, wrap: wrap };
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
    function collectParams(title, fields, promptText, selectedDirectory, requireOneOf) {
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
            if (selectedDirectory) {
                const context = document.createElement("p");
                context.className = "magic-llm-context";
                const label = document.createElement("strong");
                label.textContent = "Selected directory: ";
                context.append(label, String(selectedDirectory));
                form.appendChild(context);
            }
            const controls = {};
            fields.forEach(function (field) {
                form.appendChild(buildField(field, controls));
            });

            // Inline validation message, hidden until submission fails.
            const errorBox = document.createElement("p");
            errorBox.className = "magic-llm-form__error";
            errorBox.setAttribute("role", "alert");
            errorBox.style.display = "none";
            form.appendChild(errorBox);

            // "One of" rule only applies when every named field actually exists.
            const oneOf = (Array.isArray(requireOneOf) ? requireOneOf : [])
                .filter(function (name) { return controls[name]; });

            function fieldLabel(name) {
                const field = fields.find(function (f) { return f.name === name; });
                return (field && field.label) || name;
            }
            function markInvalid(name) {
                const control = controls[name];
                if (control && control.wrap) control.wrap.classList.add("magic-llm-field--invalid");
            }
            function clearInvalid() {
                Object.keys(controls).forEach(function (name) {
                    const control = controls[name];
                    if (control && control.wrap) control.wrap.classList.remove("magic-llm-field--invalid");
                });
                errorBox.style.display = "none";
                errorBox.textContent = "";
            }

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

                clearInvalid();
                const errors = [];
                if (controls.name && !values.name) {
                    errors.push("Please enter a file name.");
                    markInvalid("name");
                }
                if (oneOf.length && !oneOf.some(function (name) { return values[name]; })) {
                    const labels = oneOf.map(fieldLabel);
                    errors.push("Please fill in " + labels.join(" or ") + ".");
                    oneOf.forEach(markInvalid);
                }
                if (errors.length) {
                    errorBox.textContent = errors.join(" ");
                    errorBox.style.display = "";
                    return;
                }
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
    // Run store + header status refresh
    //
    // Runs are async and tracked server-side (the registry). This store polls
    // /api/llm/runs while anything is active and lets any waiter resolve when
    // its run reaches a terminal state. Aggregate counters live in Magic log.
    // ------------------------------------------------------------------
    const RunStore = (function () {
        const runs = new Map();       // id -> run object (server shape)
        const waiters = new Map();    // id -> [resolve fns]
        let polling = false;
        let pollTimer = null;

        function isTerminal(run) { return run && run.status && run.status !== "running"; }

        function anyRunning() {
            for (const run of runs.values()) if (run.status === "running") return true;
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
                // transient — try again on the next tick
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

        function add(run) {
            runs.set(run.id, run);
            window.dispatchEvent(new Event("magic-log-updated"));
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

        function init() {
            if (document.body) ensurePolling();
            else document.addEventListener("DOMContentLoaded", ensurePolling);
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
                const requireOneOf = scenario.ui && scenario.ui.requireOneOf;
                params = await collectParams(title, fields, scenario.prompt, options.selectedDirectory, requireOneOf);
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

        // Mirror this run's progress on the source button and surface its
        // result here when it finishes.
        const restore = setButtonLoading(button, loadingLabel);
        const finalRun = await RunStore.waitFor(run.id);
        restore();

        if (finalRun.status === "done") {
            showModal(title, finalRun.text || "Empty response.", false);
            return finalRun;
        }
        if (finalRun.status === "cancelled") {
            return null; // cancelled
        }
        showModal(title, finalRun.error || "The run failed.", true);
        return null;
    }

    RunStore.init();
    window.magicLlm = { runScenario: runScenario, fetchScenario: fetchScenario };
})();
