#!/usr/bin/env node
/**
 * Unit tests for ContentView versions summary helpers.
 * Loads extracted content-view modules into a minimal browser-like global.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

const sandbox = {
  console,
  window: {},
  document: {
    createElement: () => ({
      classList: { add() {}, remove() {}, toggle() {} },
      appendChild() {},
      querySelector() { return null; },
      setAttribute() {},
      addEventListener() {},
    }),
  },
  localStorage: {
    getItem() { return null; },
  },
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;

function loadModule(relPath) {
  let source = fs.readFileSync(path.join(root, relPath), "utf8");
  source = source.replace(/^import\s+[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm, "");
  source = source.replace(/^export\s+function\s+/gm, "function ");
  source = source.replace(/^export\s+const\s+/gm, "var ");
  source = source.replace(/^export\s+\{[^}]+\};?\s*$/gm, "");
  vm.runInNewContext(source, sandbox, { filename: relPath });
}

[
  "app/frontend/assets/js/shared/preferences.js",
  "app/frontend/assets/js/data/content-view/helpers.js",
  "app/frontend/assets/js/data/content-view/document-history.js",
  "app/frontend/assets/js/data/content-view/magic-fill.js",
  "app/frontend/assets/js/data/content-view/text-view.js",
  "app/frontend/assets/js/data/content-view/table-view.js",
  "app/frontend/assets/js/data/content-view/export.js",
].forEach(loadModule);

const {
  summarizeDocumentHistory,
  formatHistoryInstant,
  toMarkdownTable,
  boolSum,
} = sandbox;

let pass = 0;
let fail = 0;

function assert(name, condition) {
  if (condition) {
    console.log(`PASS: ${name}`);
    pass += 1;
  } else {
    console.error(`FAIL: ${name}`);
    fail += 1;
  }
}

// --- newest-first versions object (first key = updated, last = created) ---
const summary = summarizeDocumentHistory({
  metadata: {
    description: "d",
    versions: {
      v3: { at: "2026-07-26T10:00:00Z", comment: "c" },
      v2: { at: "2026-07-26T09:15:00Z", comment: "b" },
      v1: { at: "2026-07-26T08:30:00Z", comment: "a" },
    },
  },
  schema: {},
  items: [],
});
assert("summary exists for valid versions", summary !== null);
assert("version from newest key", summary && summary.version === 3);
assert(
  "created from oldest at",
  summary &&
    summary.created === formatHistoryInstant("2026-07-26T08:30:00Z")
);
assert(
  "updated from newest at",
  summary &&
    summary.updated === formatHistoryInstant("2026-07-26T10:00:00Z")
);

// --- missing / malformed versions ---
assert(
  "null when versions missing",
  summarizeDocumentHistory({ metadata: { description: "d" } }) === null
);

assert("bool sum counts direct true values", boolSum({ a: true, b: false, c: true }) === 2);
assert(
  "bool sum ignores nested true values",
  boolSum({ a: true, nested: { b: true }, list: [true] }) === 1
);
assert(
  "null when metadata missing",
  summarizeDocumentHistory({ schema: {}, items: [] }) === null
);
assert("null for non-object root", summarizeDocumentHistory(null) === null);
assert(
  "null when versions empty",
  summarizeDocumentHistory({ metadata: { versions: {} } }) === null
);
assert(
  "null when versions is array",
  summarizeDocumentHistory({
    metadata: {
      versions: [{ at: "2026-07-26T08:30:00Z", comment: "x" }],
    },
  }) === null
);
assert(
  "null when newest key not vN",
  summarizeDocumentHistory({
    metadata: {
      versions: {
        "3": { at: "2026-07-26T08:30:00Z", comment: "x" },
      },
    },
  }) === null
);
assert(
  "null when at invalid",
  summarizeDocumentHistory({
    metadata: {
      versions: {
        v1: { at: "not-a-date", comment: "x" },
      },
    },
  }) === null
);

// formatHistoryInstant basics
assert("invalid instant -> null", formatHistoryInstant("nope") === null);
assert("empty instant -> null", formatHistoryInstant("") === null);
const formatted = formatHistoryInstant("2026-07-26T08:30:00Z");
assert(
  "valid instant formats to YYYY-MM-DD HH:MM",
  typeof formatted === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(formatted)
);

// --- Markdown Table export ---
const md = toMarkdownTable(
  JSON.stringify({
    metadata: {
      description: "Sample countries",
      versions: {
        v2: { at: "2026-07-26T09:15:00Z", comment: "b" },
        v1: { at: "2026-07-26T08:30:00Z", comment: "a" },
      },
    },
    schema: {},
    items: [
      { name: "Albania", population: 1 },
      { name: "A|B", population: null },
    ],
  }),
  "example"
);
assert("markdown starts with title", md.startsWith("# example\n"));
assert("markdown has Meta heading", md.includes("\n## Meta\n"));
assert(
  "markdown has Created from versions",
  md.includes("- Created: " + formatHistoryInstant("2026-07-26T08:30:00Z"))
);
assert(
  "markdown has Updated from versions",
  md.includes("- Updated: " + formatHistoryInstant("2026-07-26T09:15:00Z"))
);
assert("markdown has Version from newest key", md.includes("- Version: 2"));
assert("markdown has Description label", md.includes("\nDescription:\nSample countries\n"));
assert("markdown has Table heading", md.includes("\n## Table\n"));
assert("markdown table header row", md.includes("| name | population |"));
assert("markdown table separator", md.includes("| --- | --- |"));
assert("markdown escapes pipe in cell", md.includes("| A\\|B | null |"));
assert(
  "markdown ends with GitHub attribution",
  md.endsWith(
    "\n---\n\nGenerated with [Magic Data](https://github.com/md2it/magic-data)"
  )
);
assert(
  "markdown empty meta when no versions",
  toMarkdownTable(JSON.stringify({ schema: {}, items: [] }), "x").includes(
    "- Created: \n- Updated: \n- Version: \n"
  )
);

console.log(`\nhistory-meta tests: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
