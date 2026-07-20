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
.magic-llm-field input {
    padding: 8px 10px;
    border: 1px solid #d0d7de;
    border-radius: 6px;
    font: inherit;
}
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

    // A scenario may declare optional parameters as a { name: label } map.
    // Returns the declared fields as [name, label] pairs, or [] when none.
    function declaredParams(scenario) {
        const params = scenario && scenario.params;
        if (!params || typeof params !== "object") return [];
        return Object.keys(params).map((name) => [name, String(params[name] || name)]);
    }

    // Show a small form for the declared optional parameters. Resolves with a
    // { name: value } object, or null if the user cancelled.
    function collectParams(title, fields) {
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
            const inputs = {};
            fields.forEach(function (pair) {
                const field = document.createElement("label");
                field.className = "magic-llm-field";
                const caption = document.createElement("span");
                caption.textContent = pair[1];
                const input = document.createElement("input");
                input.type = "text";
                input.name = pair[0];
                inputs[pair[0]] = input;
                field.append(caption, input);
                form.appendChild(field);
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
                Object.keys(inputs).forEach(function (name) {
                    values[name] = inputs[name].value.trim();
                });
                close(values);
            });
            document.addEventListener("keydown", onKeydown);

            footer.append(cancel, run);
            form.appendChild(footer);
            modal.append(header, form);
            backdrop.appendChild(modal);
            document.body.appendChild(backdrop);
            const first = fields[0] && inputs[fields[0][0]];
            if (first) first.focus();
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
                params = await collectParams(title, fields);
                if (params === null) return null; // cancelled
            }
        }

        // The context carries call-site info (e.g. the current document) plus
        // any collected optional parameters.
        const context = Object.assign({}, options.context || {});
        if (params) context.params = Object.assign({}, context.params, params);

        const restore = setButtonLoading(button, loadingLabel);
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
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.error || `Request failed: ${response.status}`);
            }
            showModal(title, data.text || "Empty response.", false);
            return data;
        } catch (error) {
            const message =
                error instanceof TypeError
                    ? "The local LLM engine is not reachable. Is the app still running?"
                    : error instanceof Error
                        ? error.message
                        : String(error);
            showModal(title, message, true);
            return null;
        } finally {
            restore();
        }
    }

    window.magicLlm = { runScenario: runScenario, fetchScenario: fetchScenario };
})();
