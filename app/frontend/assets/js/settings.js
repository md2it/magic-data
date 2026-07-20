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
});
