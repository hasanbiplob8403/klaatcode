/**
 * N-way bench report summary — first report is the reference (KlaatCode);
 * every other agent gets ratio columns against it.
 *
 * Usage:
 *   bun bench/summary-multi.ts reports/<klaatcode>.json reports/claude-*.json reports/opencode-*.json reports/grok-*.json
 *
 * Prints an aggregate table + per-category accuracy. Only tasks present in
 * ALL reports enter the ratio math (partial runs stay comparable).
 */

import { readFile } from "node:fs/promises";
import { basename } from "node:path";

interface TaskRow {
  id: string; category?: string; passed: boolean; costUsd: number;
  totalTokens: number; turns: number; elapsedMs: number; costEstimated?: boolean;
}
interface Report {
  agent?: string; model?: string; solved: number; total: number;
  totalCostUsd: number; tasks: TaskRow[]; complete?: boolean;
}

const paths = process.argv.slice(2);
if (paths.length < 2) {
  console.error("Usage: bun bench/summary-multi.ts <reference.json> <other.json> [more.json…]");
  process.exit(1);
}

const reports: { name: string; model: string; r: Report }[] = [];
for (const p of paths) {
  const r = JSON.parse(await readFile(p, "utf-8")) as Report;
  reports.push({ name: r.agent ?? basename(p).replace(/\.json$/, ""), model: r.model ?? "?", r });
}

// Intersection of task ids across all reports.
let shared = new Set(reports[0]!.r.tasks.map(t => t.id));
for (const { r } of reports.slice(1)) {
  const ids = new Set(r.tasks.map(t => t.id));
  shared = new Set([...shared].filter(id => ids.has(id)));
}

interface Agg {
  name: string; model: string; solved: number; cost: number; est: boolean;
  tokens: number; turns: number; ms: number; perCat: Map<string, { pass: number; total: number }>;
}
const aggs: Agg[] = reports.map(({ name, model, r }) => {
  const rows = r.tasks.filter(t => shared.has(t.id));
  const perCat = new Map<string, { pass: number; total: number }>();
  for (const t of rows) {
    const c = t.category ?? "?";
    const e = perCat.get(c) ?? { pass: 0, total: 0 };
    e.total++; if (t.passed) e.pass++;
    perCat.set(c, e);
  }
  return {
    name, model,
    solved: rows.filter(t => t.passed).length,
    cost: rows.reduce((s, t) => s + t.costUsd, 0),
    est: rows.some(t => t.costEstimated),
    tokens: rows.reduce((s, t) => s + t.totalTokens, 0),
    turns: rows.reduce((s, t) => s + t.turns, 0),
    ms: rows.reduce((s, t) => s + t.elapsedMs, 0),
    perCat,
  };
});

const ref = aggs[0]!;
const n = shared.size;
const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const money = (x: number, est: boolean) => `${est ? "~" : ""}$${x.toFixed(4)}`;
const mins = (ms: number) => `${(ms / 60000).toFixed(1)}m`;

console.log(`\n  ${n} shared tasks across ${aggs.length} agents\n`);
console.log(`  ${"agent".padEnd(12)} ${"model".padEnd(24)} ${"solved".padEnd(8)} ${"cost".padEnd(11)} ${"$/solve".padEnd(11)} ${"tokens".padEnd(10)} ${"turns".padEnd(6)} ${"wall".padEnd(7)} ${"cost vs ref"}`);
console.log(`  ${"─".repeat(12)} ${"─".repeat(24)} ${"─".repeat(8)} ${"─".repeat(11)} ${"─".repeat(11)} ${"─".repeat(10)} ${"─".repeat(6)} ${"─".repeat(7)} ${"─".repeat(11)}`);
for (const a of aggs) {
  const perSolve = a.solved ? a.cost / a.solved : 0;
  const ratio = a === ref ? "(ref)" : ref.cost > 0 && a.cost > 0 ? pct(ref.cost / a.cost) + " of theirs" : "—";
  console.log(
    `  ${a.name.padEnd(12)} ${a.model.slice(0, 24).padEnd(24)} ${`${a.solved}/${n}`.padEnd(8)} ` +
    `${money(a.cost, a.est).padEnd(11)} ${money(perSolve, a.est).padEnd(11)} ` +
    `${String(a.tokens).padEnd(10)} ${String(a.turns).padEnd(6)} ${mins(a.ms).padEnd(7)} ${ratio}`,
  );
}

console.log(`\n  Per-category accuracy:`);
const cats = [...ref.perCat.keys()].sort();
console.log(`  ${"category".padEnd(14)} ${aggs.map(a => a.name.slice(0, 10).padEnd(10)).join(" ")}`);
for (const c of cats) {
  const cells = aggs.map(a => {
    const e = a.perCat.get(c);
    return (e ? `${e.pass}/${e.total}` : "—").padEnd(10);
  });
  console.log(`  ${c.padEnd(14)} ${cells.join(" ")}`);
}
console.log();
