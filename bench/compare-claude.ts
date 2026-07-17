/**
 * Claude Code comparison run (Phase 7.1).
 *
 * Runs the SAME suite.json tasks through Claude Code headless (`claude -p`)
 * over the SAME fixtures with the SAME verify command — the only variable is
 * the agent. Claude Code's `--output-format json` reports its own
 * total_cost_usd / usage / num_turns, so numbers are authoritative, not
 * estimated.
 *
 * Usage:
 *   bun bench/compare-claude.ts                     # whole suite
 *   bun bench/compare-claude.ts --only fix-fizzbuzz
 *   bun bench/compare-claude.ts --from <id>         # resume mid-suite
 *   bun bench/compare-claude.ts --model sonnet      # pin a model
 *
 * Report: bench/reports/claude-<stamp>.json — same shape as run.ts reports,
 * so the two JSONs diff directly. Compare with bench/compare-summary.ts.
 *
 * Notes:
 * - Uses --dangerously-skip-permissions; safe because cwd is a throwaway
 *   temp workspace (same isolation the KlaatCode harness uses).
 * - Cost on a subscription login is reported at API-metered prices — that is
 *   exactly what we want for a fair $ comparison.
 */

import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));

interface Task {
  id: string; dir: string; prompt: string; difficulty?: string;
  category?: string; verify?: string;
}
interface Suite { name: string; verify: string; tasks: Task[] }

interface TaskReport {
  id: string; difficulty?: string; category?: string;
  passed: boolean;
  promptTokens: number; completionTokens: number; totalTokens: number;
  cacheReadTokens: number; cacheCreateTokens: number;
  turns: number; costUsd: number; model: string;
  elapsedMs: number; error?: string;
}

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function runTask(suite: Suite, task: Task, model: string | undefined): Promise<TaskReport> {
  const fixture = resolve(HERE, task.dir);
  const work = await mkdtemp(join(tmpdir(), `ccbench-${task.id}-`));
  try {
    await cp(fixture, work, { recursive: true });

    const started = performance.now();
    const args = [
      "-p", task.prompt,
      "--output-format", "json",
      "--dangerously-skip-permissions",
      "--max-turns", "40",
    ];
    if (model) args.push("--model", model);

    const r = spawnSync("claude", args, {
      cwd: work, encoding: "utf-8", timeout: 600_000,
      env: { ...process.env },
    });
    const elapsedMs = Math.round(performance.now() - started);

    // Parse Claude Code's own metrics from its JSON result envelope.
    let costUsd = 0, turns = 0, promptTokens = 0, completionTokens = 0;
    let cacheReadTokens = 0, cacheCreateTokens = 0, usedModel = model ?? "default";
    let error: string | undefined;
    try {
      const out = JSON.parse(r.stdout || "{}") as {
        total_cost_usd?: number; num_turns?: number; is_error?: boolean;
        subtype?: string; result?: string;
        usage?: {
          input_tokens?: number; output_tokens?: number;
          cache_read_input_tokens?: number; cache_creation_input_tokens?: number;
        };
        modelUsage?: Record<string, unknown>;
      };
      costUsd = out.total_cost_usd ?? 0;
      turns = out.num_turns ?? 0;
      promptTokens = out.usage?.input_tokens ?? 0;
      completionTokens = out.usage?.output_tokens ?? 0;
      cacheReadTokens = out.usage?.cache_read_input_tokens ?? 0;
      cacheCreateTokens = out.usage?.cache_creation_input_tokens ?? 0;
      const models = Object.keys(out.modelUsage ?? {});
      if (models.length) usedModel = models.join("+");
      if (out.is_error) error = out.subtype ?? "claude reported error";
    } catch {
      error = `unparseable claude output (exit ${r.status})`;
    }
    if (r.status !== 0 && !error) error = `claude exited ${r.status}`;

    // Verify with the same command as the KlaatCode run.
    const verifyCmd = task.verify ?? suite.verify;
    const [cmd, ...cmdArgs] = verifyCmd.split(" ");
    const v = spawnSync(cmd!, cmdArgs, { cwd: work, encoding: "utf-8", timeout: 60_000 });
    const passed = v.status === 0;

    return {
      id: task.id, difficulty: task.difficulty, category: task.category, passed,
      promptTokens, completionTokens,
      // Cache reads are still input the provider bills (at reduced rate) —
      // report them separately AND in the total so token comparisons are honest.
      totalTokens: promptTokens + completionTokens + cacheReadTokens + cacheCreateTokens,
      cacheReadTokens, cacheCreateTokens,
      turns, costUsd, model: usedModel, elapsedMs, error,
    };
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => {});
  }
}

async function main(): Promise<void> {
  const suite = JSON.parse(await readFile(resolve(HERE, "suite.json"), "utf-8")) as Suite;
  const only = arg("only");
  const from = arg("from");
  const category = arg("category");
  const model = arg("model");

  let tasks = only ? suite.tasks.filter(t => t.id === only) : suite.tasks;
  if (category) tasks = tasks.filter(t => t.category === category);
  if (from) {
    const i = tasks.findIndex(t => t.id === from);
    if (i === -1) { console.error(`No task matches --from ${from}`); process.exit(1); }
    tasks = tasks.slice(i);
  }
  if (!tasks.length) { console.error("No task matches the given filters"); process.exit(1); }

  console.log(`\n  claude-code comparison — ${tasks.length} task(s)${model ? `, model=${model}` : ", default model"}\n`);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = resolve(HERE, "reports");
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, `claude-${stamp}.json`);
  const saveReport = async (reports: TaskReport[], done: boolean) => {
    const solved = reports.filter(r => r.passed).length;
    await writeFile(outPath, JSON.stringify({
      suite: suite.name, agent: "claude-code", model: model ?? "default",
      when: stamp, complete: done,
      solved, total: reports.length, planned: tasks.length,
      totalCostUsd: reports.reduce((s, r) => s + r.costUsd, 0),
      totalTokens: reports.reduce((s, r) => s + r.totalTokens, 0),
      tasks: reports,
    }, null, 2));
  };

  const reports: TaskReport[] = [];
  for (const task of tasks) {
    process.stdout.write(`  ▸ ${task.id.padEnd(28)} `);
    const rep = await runTask(suite, task, model);
    reports.push(rep);
    await saveReport(reports, false); // incremental — abort-safe
    const mark = rep.passed ? "PASS" : "FAIL";
    console.log(`${mark}  $${rep.costUsd.toFixed(4)}  ${rep.totalTokens} tok (${rep.cacheReadTokens} cached)  ${rep.turns} turns  ${(rep.elapsedMs / 1000).toFixed(0)}s${rep.error ? `  (${rep.error})` : ""}`);
  }

  const solved = reports.filter(r => r.passed).length;
  const totalCost = reports.reduce((s, r) => s + r.costUsd, 0);
  console.log(`\n  ── Summary ─────────────────────────────`);
  console.log(`  Solved:     ${solved}/${reports.length}`);
  console.log(`  Total cost: $${totalCost.toFixed(4)}`);
  console.log(`  Cost/solve: ${solved ? `$${(totalCost / solved).toFixed(4)}` : "—"}`);

  await saveReport(reports, true);
  console.log(`\n  Report: ${outPath}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
