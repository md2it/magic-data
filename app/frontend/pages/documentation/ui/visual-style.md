---
title: UI visual style · Magic-data
---

> [Documentation](/documentation) / [UI](/documentation/ui) / Visual style

# UI visual style

This document defines the product's visual direction. All implementation must comply with [UI technical standards](technical-standards).

## Principle

Magic-data is a quiet, professional tool for working with data. The data and the current task take visual priority over the interface. Show only what is needed now.

## Visual hierarchy

- Use one calm neutral base palette and one restrained accent color for primary actions and current focus.
- Reserve semantic colors for status and feedback. Never use them as decoration.
- Make selected, focused, running, and error states clearly stronger than their idle equivalents.
- Keep inactive controls muted but legible. Do not make them compete with the current task.
- Use type scale, whitespace, contrast, and grouping to establish hierarchy before adding color, borders, or icons.

## Surfaces and shape

- Use a light neutral application background and simple, readable content surfaces.
- Use thin, low-contrast borders to separate ordinary regions.
- Apply one consistent family of small-to-medium corner radii. Do not mix sharp and heavily rounded shapes without a functional reason.
- Use shadows sparingly and only to communicate elevation, such as an overlay or floating control.
- Do not use decorative gradients, colored cards, glass effects, or ornamental textures.

## Density and layout

- Use a consistent spacing scale. Whitespace must clarify grouping and hierarchy, not decorate empty areas.
- Prefer compact, scannable layouts for data. Provide enough spacing for clarity without turning the workspace into a dashboard of cards.
- Keep secondary navigation, catalogues, inspectors, and auxiliary controls collapsible.
- Do not expose optional controls until context, selection, hover, or focus makes them relevant.

## Controls and Magic buttons

- Use a single primary action per local decision area. All other actions must be secondary or contextual.
- Magic buttons are contextual actions, not permanent visual anchors. In dense views such as tables, show them on the active row, column, cell, or table, or keep them subdued until hover or focus.
- A Magic button running an action must visibly communicate its in-progress state and prevent accidental duplicate execution.
- Hidden contextual actions must become available to keyboard users through focus and to touch users through selection or an equivalent explicit interaction.

## Typography, icons, and feedback

- Use a restrained type hierarchy with high legibility. Avoid display typography and excessive weight variation.
- Icons must clarify an action or state; they do not replace an accessible text label when the meaning is not universally obvious.
- Use concise feedback close to the affected task. Reserve global notifications for cross-page or background outcomes.

## Restraint

- Do not add visual effects, motion, settings, variants, or customization solely because they are available.
- Add a new visible control only when it supports a demonstrated user task that cannot be served by an existing control, contextual action, or progressive disclosure.
- When a choice does not improve the task, remove it or keep it out of the default view.
