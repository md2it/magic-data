document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".settings-magic .magic-btn").forEach(function (button) {
        button.addEventListener("click", function () {
            if (!window.magicLlm) return;
            window.magicLlm.runScenario("connection-test", {
                provider: button.getAttribute("data-provider"),
                button: button,
            });
        });
    });

    const VALID_VIEWS = [
        { id: "table", label: "Table" },
        { id: "json", label: "JSON" },
        { id: "tree", label: "Tree" },
        { id: "text", label: "Text" },
    ];
    const STORAGE_KEY = "magicdata.defaultView";
    const FALLBACK = "table";
    const BOOLEAN_ICONS_STORAGE_KEY = "magicdata.booleanIcons";

    function getDefaultView() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (VALID_VIEWS.some(function (view) { return view.id === stored; })) {
                return stored;
            }
        } catch (e) {
            /* storage unavailable */
        }
        return FALLBACK;
    }

    document.querySelectorAll("select[data-default-view]").forEach(function (sel) {
        VALID_VIEWS.forEach(function (view) {
            const option = document.createElement("option");
            option.value = view.id;
            option.textContent = view.label;
            sel.appendChild(option);
        });
        sel.value = getDefaultView();
        sel.addEventListener("change", function () {
            try {
                localStorage.setItem(STORAGE_KEY, sel.value);
            } catch (e) {
                /* storage unavailable — keep session-only choice */
            }
        });
    });

    function getBooleanIconsEnabled() {
        try {
            const stored = localStorage.getItem(BOOLEAN_ICONS_STORAGE_KEY);
            return stored === null ? true : stored === "true";
        } catch (e) {
            return true;
        }
    }

    document.querySelectorAll("input[data-boolean-icons]").forEach(function (toggle) {
        toggle.checked = getBooleanIconsEnabled();
        toggle.addEventListener("change", function () {
            try {
                localStorage.setItem(BOOLEAN_ICONS_STORAGE_KEY, String(toggle.checked));
            } catch (e) {
                /* storage unavailable — keep session-only choice */
            }
        });
    });
});
