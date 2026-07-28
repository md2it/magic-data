(function () {
    "use strict";

    const iconSprite = "/assets/images/icons.svg";

    function markup(name, modifier) {
        const className = modifier ? `icon ${modifier}` : "icon";
        return `<svg class="${className}" aria-hidden="true"><use href="${iconSprite}#${name}"></use></svg>`;
    }

    function setLabel(element, name, label) {
        element.innerHTML = markup(name);
        if (label != null && label !== "") element.append(" ", label);
    }

    window.AppIcons = { markup: markup, setLabel: setLabel };
})();
