---
title: UI components · Magic-data
---

> [documentation](/documentation) / [developers](/documentation/developers) / [ui](/documentation/developers/ui) / [components](/documentation/developers/ui/components)

# UI components

Follow [visual-style](visual-style) and [technical-standards](technical-standards).

## Existing components

### Application shell

- **Header** (`.app-header`) — the fixed top bar: product title, main
  navigation (Data, Documentation), and the process actions Restart
  app and Stop app. If Magic AI processes are still running, these actions ask
  for confirmation first. Rendered once by `layout.js`.
- **Footer** (`.app-footer`) — product name, repository link, and GitHub Issues
  link. A separate **print footer** (`.print-footer`) repeats per page when
  printing.
- **Sidebar** — the collapsible catalogue of files and directories: the file
  **tree** (`.tree-list` / `.tree-node`, and `.directory-listing` for a plain
  listing), a **sidebar toolbar** (`.sidebar-toolbar`) of catalogue actions
  pinned under the tree above the collapse control, and a transient **toast**
  (`.sidebar-toast`) for background outcomes.

### Data views

The **view switch** (`.view-switch`) selects one view for the main content area.
The chosen view is always reflected in the document URL as `?view=…`. When the
URL has no view, the default-view preference from the Data settings pop-up is
used (product default: table).

- **JSON view** (`.json-node`) — the raw structure, rendered close to literal
  JSON, with collapsible nodes.
- **Tree view** (`.content-tree-node`) — the same data as a labelled,
  collapsible tree.
- **Table view** (`.content-table`) — records as rows, with sortable header
  cells (`.content-table__header-cell--sortable`) and a sort indicator that
  uses `chevrons-up-down` to mark a column that can be sorted but is not yet.
  Compact column widths and the truncated-cell overlay are specified in
  [table-view-compact-cells](table-view-compact-cells).

Schema-defining portions are de-emphasized rather than hidden (see the
[visual-style](visual-style)).

### Content toolbar and Magic buttons

- **Content toolbar** (`.content-toolbar`) — actions for the current view:
  download (`.content-toolbar__download`), overflow **dropdown**
  (`.content-toolbar__dropdown`), and Magic buttons.
- **Settings** — a cog control on the Data content toolbar (tooltip Settings)
  opens the preferences pop-up (`.data-settings-popup`). The pop-up holds a
  **settings list** (`.settings-list` / `.settings-item`) of labelled rows:
  **select** controls (`.settings-select`, e.g. default view and number format)
  and **switch** toggles (`.settings-toggle`, e.g. boolean icons and bool sum).
  Preferences are stored in the browser; there is no separate Settings page.
- **Magic buttons** — contextual AI actions marked with `sparkles`, available on
  a table, row, column, cell, or the whole document. A running Magic button
  shows its in-progress state and blocks duplicate execution. See
  [llm-engine](/documentation/developers/llm-engine).

### Static pages

- **Markdown page** (`.static-page` / `.markdown-content`) — documentation and
  help content rendered from Markdown into the shared layout.

## Tooltips

Tooltips explain a control — most importantly an icon-only one (see
[imagery](imagery)). Every tooltip in the
product shares one style so it reads as the same object everywhere:

- **Tail** — a small pointer (tail) connects the tooltip to the element it
  describes, so the association is unambiguous.
- **Adaptive width** — the tooltip sizes to its content up to a fixed maximum
  width, then wraps. It never stretches to a full-width bar for a short label.
- **Small radius** — corners use the product's small corner radius, consistent
  with other surfaces.
- **High contrast** — text and background meet the contrast requirement in
  [technical-standards](technical-standards) and stand clearly above the content
  behind them.
- **Top layer** — a tooltip renders above every other layer, matching the
  ordered z-index scale (tooltips are the highest layer).

A tooltip is an aid, not the accessible name of a control; an icon-only control
must still carry an `aria-label` or equivalent.

**Usage.** Add a `data-tooltip="..."` attribute to any element; `tooltip.js`
(loaded globally) shows it on hover and keyboard focus through the one shared
`#app-tooltip` element, styled by `assets/css/tooltip.css`. Because that element
is positioned on `<body>`, the tooltip escapes clipping toolbars and scrolling
tables. Do not use the native `title` attribute for the same purpose — it would
duplicate the tooltip and bypass the shared style.
