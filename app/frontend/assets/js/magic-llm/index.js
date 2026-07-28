/** Magic LLM frontend adapter (scenario → params → run → UI). */
import { fetchScenario, startAndWait } from "./client.js";
import {
    collectParams,
    declaredParams,
    setButtonLoading,
    showModal,
} from "./ui.js";

async function runScenario(scenarioId, options) {
    options = options || {};
    const scenario = await fetchScenario(scenarioId).catch(() => null);
    const title = (scenario && scenario.ui && scenario.ui.label) || scenarioId;
    const loadingLabel =
        options.loadingLabel ||
        (scenario && scenario.ui && scenario.ui.loadingLabel) ||
        "Running...";

    let params = options.params || null;
    if (!params && scenario) {
        const fields = declaredParams(scenario);
        if (fields.length > 0) {
            const requireOneOf = scenario.ui && scenario.ui.requireOneOf;
            params = await collectParams(
                title,
                fields,
                scenario.prompt,
                options.selectedDirectory,
                requireOneOf
            );
            if (params === null) return null;
        }
    }

    const context = Object.assign({}, options.context || {});
    if (params) context.params = Object.assign({}, context.params, params);

    const restore = setButtonLoading(options.button || null, loadingLabel);
    let finalRun;
    try {
        finalRun = await startAndWait(scenarioId, options, context);
    } catch (error) {
        restore();
        const message =
            error instanceof TypeError
                ? "The local LLM engine is not reachable. Is the app still running?"
                : error instanceof Error ? error.message : String(error);
        showModal(title, message, true);
        return null;
    }
    restore();

    if (!finalRun) {
        showModal(title, "The run could not be created.", true);
        return null;
    }
    if (finalRun.status === "done") {
        showModal(title, finalRun.text || "Empty response.", false);
        return finalRun;
    }
    if (finalRun.status === "cancelled") return null;

    showModal(title, finalRun.error || "The run failed.", true);
    return null;
}

window.magicLlm = {
    runScenario: runScenario,
    fetchScenario: fetchScenario,
};
