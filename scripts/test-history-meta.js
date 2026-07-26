#!/usr/bin/env node
/**
 * Unit tests for ContentView history summary helpers.
 * Loads content-view.js in a minimal browser-like global and exercises
 * summarizeDocumentHistory / formatHistoryInstant.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(
  path.join(root, "app/frontend/assets/js/content-view.js"),
  "utf8"
);

const sandbox = {
  console,
  window: {},
  document: {
    createElement: () => ({
      classList: { add() {}, remove() {}, toggle() {} },
      appendChild() {},
      querySelector() { return null; },
      setAttribute() {},
    }),
  },
  localStorage: {
    getItem() { return null; },
  },
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;

vm.runInNewContext(source, sandbox, { filename: "content-view.js" });

const {
  summarizeDocumentHistory,
  formatHistoryInstant,
} = sandbox.window.ContentView;

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

// --- first / last history entries ---
const summary = summarizeDocumentHistory({
  metadata: {
    description: "d",
    history: [
      { version: 1, at: "2026-07-26T08:30:00Z", comment: "a" },
      { version: 2, at: "2026-07-26T09:15:00Z", comment: "b" },
      { version: 3, at: "2026-07-26T10:00:00Z", comment: "c" },
    ],
  },
  schema: {},
  items: [],
});
assert("summary exists for valid history", summary !== null);
assert("version from last entry", summary && summary.version === 3);
assert(
  "created from first at",
  summary &&
    summary.created === formatHistoryInstant("2026-07-26T08:30:00Z")
);
assert(
  "updated from last at",
  summary &&
    summary.updated === formatHistoryInstant("2026-07-26T10:00:00Z")
);

// --- missing history ---
assert(
  "null when history missing",
  summarizeDocumentHistory({ metadata: { description: "d" } }) === null
);
assert(
  "null when metadata missing",
  summarizeDocumentHistory({ schema: {}, items: [] }) === null
);
assert("null for non-object root", summarizeDocumentHistory(null) === null);
assert(
  "null when history empty",
  summarizeDocumentHistory({ metadata: { history: [] } }) === null
);
assert(
  "null when history not array",
  summarizeDocumentHistory({ metadata: { history: { version: 1 } } }) === null
);
assert(
  "null when last version not int",
  summarizeDocumentHistory({
    metadata: {
      history: [{ version: "1", at: "2026-07-26T08:30:00Z", comment: "x" }],
    },
  }) === null
);
assert(
  "null when at invalid",
  summarizeDocumentHistory({
    metadata: {
      history: [{ version: 1, at: "not-a-date", comment: "x" }],
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

console.log(`\nhistory-meta tests: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
