#!/usr/bin/env node
/** Detect circular ESM imports under app/frontend/assets/js. */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../app/frontend/assets/js");

function listJsFiles(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...listJsFiles(full));
        else if (entry.name.endsWith(".js")) out.push(full);
    }
    return out;
}

function resolveImport(fromFile, spec) {
    if (!spec.startsWith(".")) return null;
    const base = path.resolve(path.dirname(fromFile), spec);
    if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
    if (fs.existsSync(base + ".js")) return base + ".js";
    if (fs.existsSync(path.join(base, "index.js"))) return path.join(base, "index.js");
    return null;
}

function importsOf(file) {
    const text = fs.readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
    const deps = [];
    const re = /\b(?:import\s+["']([^"']+)["']|from\s+["']([^"']+)["'])/g;
    let match;
    while ((match = re.exec(text))) {
        const resolved = resolveImport(file, match[1] || match[2]);
        if (resolved) deps.push(resolved);
    }
    return [...new Set(deps)];
}

const files = listJsFiles(ROOT);
const graph = new Map(files.map((f) => [f, importsOf(f)]));

const cycles = [];
const stack = [];
const stackSet = new Set();
const visited = new Set();

function dfs(node) {
    if (stackSet.has(node)) {
        const i = stack.indexOf(node);
        cycles.push(stack.slice(i).concat(node));
        return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    stack.push(node);
    stackSet.add(node);
    for (const dep of graph.get(node) || []) dfs(dep);
    stack.pop();
    stackSet.delete(node);
}

for (const file of files) dfs(file);

function rel(p) {
    return path.relative(ROOT, p);
}

if (cycles.length) {
    console.error("Cycles found:");
    for (const cycle of cycles) {
        console.error("  " + cycle.map(rel).join(" -> "));
    }
    process.exit(1);
}

console.log("No cycles among", files.length, "JS modules under assets/js");
for (const [file, deps] of [...graph.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (!deps.length) continue;
    console.log(rel(file) + " -> " + deps.map(rel).join(", "));
}
