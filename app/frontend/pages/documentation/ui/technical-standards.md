---
title: UI technical standards · Magic-data
---

> [Documentation](/documentation) / [UI](/documentation/ui) / Technical standards

# UI technical standards

These rules define the implementation boundaries for every UI change. The visual decisions are defined separately in [Visual style](visual-style).

## Component ownership

- A repeated UI pattern must have one shared component implementation. Pages configure and compose it; they do not duplicate its markup, behavior, or styles.
- A component owns its states, accessibility behavior, and responsive behavior.
- Do not introduce a new component when an existing component can be extended without making its public API unclear.

## HTML identity and classes

- An element that exists exactly once in the application must have a unique `id`.
- Do not assign `id` values to repeated elements or use an `id` for styling.
- Use classes for reusable presentation and behavior only.
- Keep the number of classes on an element to the minimum required. Avoid class combinations; use them only when each class represents an independent concern.
- Do not style by page-specific DOM structure when a component class or state can express the rule.

## Tokens and CSS

- Use CSS custom properties for every reusable color, spacing value, typography value, radius, border, opacity, shadow, duration, and z-index level.
- Reuse an existing token before creating a new one. Create a token only when it represents a stable, named design decision.
- Keep tokens semantic and global; do not encode a component name or page name in a global token.
- Do not use arbitrary literal visual values outside token definitions, except for values intrinsic to layout calculations.
- Use the defined spacing scale. Do not introduce one-off gaps, radii, or font sizes.

## States and progressive disclosure

- Every visible UI element and every applicable state must meet a minimum contrast ratio of 4.5:1 against its adjacent background.
- Every interactive element must expose distinct default, hover, focus-visible, disabled, and active states when applicable.
- Keyboard focus must always be visible and must not rely on color alone.
- Higher-priority current states — selected, focused, running, or requiring attention — must be visually stronger than equivalent idle states.
- Contextual actions may be hidden until their related object is hovered, focused, selected, or otherwise active. Their appearance and disappearance must not prevent keyboard access or cause layout shift.
- Secondary panels must be collapsible. A collapsed panel may preview temporarily on hover or focus; a user-controlled pinned state must remain open until changed by the user.

## Layering

- Create stacking contexts only when necessary. Do not use arbitrary `z-index` values.
- Use a shared ordered z-index scale: base content; raised local content; sticky navigation; transient controls; overlays; dialogs; notifications; tooltips.
- A layer may only use its assigned level. A child must not escape its parent layer to overtake unrelated interface.
- Tooltips are above all application layers. Notifications are above dialogs. Dialogs are above overlays. Overlays are above all ordinary content.

## Interaction and motion

- Preserve layout when state changes whenever possible; use opacity, color, outline, or transform before changing dimensions.
- Motion may explain a state change or feedback. It must be brief, interruptible, and respect `prefers-reduced-motion`.
- Do not use motion, color, or hover as the sole way to communicate essential state or make an action available.

## Quality gate

- A UI change is complete only when it uses shared components and tokens, works by keyboard, preserves visible focus, and has no unnecessary new stacking context or visual value.
