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
        const restore = setButtonLoading(button, loadingLabel);
        try {
            const response = await fetch("/api/llm/run", {
                method: "POST",
                cache: "no-store",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    scenarioId: scenarioId,
                    provider: options.provider,
                    context: options.context || {},
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
