---
title: UI imagery and icons · Magic-data
---

> [documentation](/documentation) / [developers](/documentation/developers) / [ui](/documentation/developers/ui) / [imagery](/documentation/developers/ui/imagery)

# UI imagery and icons

Follow [visual-style](visual-style) and [technical-standards](technical-standards).

## What imagery is allowed

Permitted without prior agreement:

- **Icons** — [Lucide](https://lucide.dev) icons, custom icons built on the
  Lucide base (same grid, stroke, and construction), and our own fully custom
  icons drawn to match that same system.
- **Other SVG** — official company logos, in their correct, unaltered form.

Requires explicit agreement:

- Any other icon set or general imagery (photos, illustrations, screenshots as
  decoration).
- Any raster or non-`SVG` format at all (`PNG`, `JPG`, `GIF`, …).

## Single source

- Every icon is stored exactly once, in the shared sprite
  `app/frontend/assets/images/icons.svg`, and pulled into the UI from that one
  place. Do not paste icon markup into a page, component, or stylesheet.
- Reference an icon by its symbol id through `<use>`:

  ```html
  <svg class="icon" aria-hidden="true">
      <use href="/assets/images/icons.svg#sparkles"></use>
  </svg>
  ```

- Adding an icon means adding one `<symbol>` to the sprite. Keep the Lucide name
  as the id, and keep any license attribution current in
  [`THIRD_PARTY_NOTICES.md`](https://github.com/md2it/magic-data/blob/main/THIRD_PARTY_NOTICES.md).

## One style for every icon

- All icons share a single style, owned by `app/frontend/assets/css/icons.css`
  (the `.icon` class): one size scale, `currentColor` for color, and a common
  stroke. An icon inherits the color of the text it sits with, so it stays
  correct in any theme — never hardcode an icon color.
- Do not restyle icons per page or per component. If a size is needed, use a
  shared size modifier rather than a one-off value.

## Icon combinations

For meanings that need two icons, place a **subject** and a **modifier** inline,
side by side:

| Action                | Composition            |
| --------------------- | ---------------------- |
| Add a file manually   | `file-plus` + `pointer`   |
| Add a file with AI    | `file-plus` + `sparkles`  |
| Add a directory manually | `folder-plus` + `pointer` |

`pointer` marks a manual action; `sparkles` marks an AI-driven action. Reuse
these meanings everywhere. Compose them as two plain `.icon` elements in the
control — no overlay or badge.

## Prefer icons for controls

- Aim to express a control as an icon, or a combination of icons, rather than a
  text label — especially for repeated and contextual actions.
- When an icon alone is not unambiguous, keep it as the control and add a
  tooltip that explains it. See tooltips in
  [components](components).
- An icon-only control still needs an accessible name (for example an
  `aria-label`); the tooltip is a visible aid, not a replacement for it.
