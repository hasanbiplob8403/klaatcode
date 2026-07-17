/**
 * Side-by-side comparison of two bench reports (KlaatCode vs Claude Code).
 *
 * Usage:
 *   bun bench/compare-summary.ts <klaatcode-report.json> <claude-report.json>
 *
 * Prints per-task and aggregate cost/token/turn ratios — the "are we actually
 * cheaper AND as accurate" table. Ratios only cover tasks present in both.
 */

import { readFile } from "node:fs/promises";

interface TaskRow {
  id: string; passed: boolean; costUsd: number; totalTokens: number; turns: number;
}
interface Report { solved: number; total: number; totalCostUsd: number; tasks: TaskRow[] }

const [aPath, bPath] = process.argv.slice(2);
if (!aPath || !bPath) {
  console.error("Usage: bun bench/compare-summary.ts <klaatcode-report.json> <claude-report.json>");
  process.exit(1);
}

const a = JSON.parse(await readFile(aPath, "utf-8")) as Report; // klaatcode
const b = JSON.parse(await readFile(bPath, "utf-8")) as Report; // claude code

const bById = new Map(b.tasks.map(t => [t.id, t]));
const rows = a.tasks.filter(t => bById.has(t.id)).map(t => ({ k: t, c: bById.get(t.id)! }));

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const mark = (p: boolean) => (p ? "✓" : "✗");

console.log(`\n  ${"task".padEnd(30)} ${"KlaatCode".padEnd(22)} ${"Claude Code".padEnd(22)} cost ratio`);
console.log(`  ${"─".repeat(30)} ${"─".repeat(22)} ${"─".repeat(22)} ──────────`);
for (const { k, c } of rows) {
  const kCol = `${mark(k.passed)} $${k.costUsd.toFixed(4)} ${k.turns}t`;
  const cCol = `${mark(c.passed)} $${c.costUsd.toFixed(4)} ${c.turns}t`;
  const ratio = c.costUsd > 0 ? pct(k.costUsd / c.costUsd) : "—";
  console.log(`  ${k.id.padEnd(30)} ${kCol.padEnd(22)} ${cCol.padEnd(22)} ${ratio}`);
}

const solvedBoth = (r: TaskRow[]) => r.filter(t => t.passed);
const kTasks = rows.map(r => r.k), cTasks = rows.map(r => r.c);
const kCost = kTasks.reduce((s, t) => s + t.costUsd, 0);
const cCost = cTasks.reduce((s, t) => s + t.costUsd, 0);
const kTok = kTasks.reduce((s, t) => s + t.totalTokens, 0);
const cTok = cTasks.reduce((s, t) => s + t.totalTokens, 0);
const kSolved = solvedBoth(kTasks).length, cSolved = solvedBoth(cTasks).length;

console.log(`\n  ── Aggregate (${rows.length} shared tasks) ─────────────`);
console.log(`  Success:    KlaatCode ${kSolved}/${rows.length}  vs  Claude Code ${cSolved}/${rows.length}`);
console.log(`  Total cost: $${kCost.toFixed(4)}  vs  $${cCost.toFixed(4)}  → KlaatCode at ${cCost ? pct(kCost / cCost) : "—"} of Claude Code`);
console.log(`  Cost/solve: $${kSolved ? (kCost / kSolved).toFixed(4) : "—"}  vs  $${cSolved ? (cCost / cSolved).toFixed(4) : "—"}  → ${kSolved && cSolved && cCost ? pct((kCost / kSolved) / (cCost / cSolved)) : "—"} (plan target ≤ 25%)`);
console.log(`  Tokens:     ${kTok}  vs  ${cTok}  → ${cTok ? pct(kTok / cTok) : "—"} (plan target ≤ 50%)\n`);
