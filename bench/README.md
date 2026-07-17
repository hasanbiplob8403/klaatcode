# KlaatCode Benchmark Harness (Phase 7)

Objective cost / tokens / success measurement per solved task. This is the
number that answers "are we actually cheaper *and* accurate vs Claude Code?"

## How it works

For each task in `suite.json`:

1. Copy the fixture dir to a fresh temp workspace (never touches the fixture).
2. Run the headless agent (`src/agent/headless-agent.ts`) — the REPL's real
   tool loop, no TUI, no permission prompts, sandboxed to the workspace.
3. Run the verify command (default `bun test`) in the workspace. Exit 0 = solved.
4. Record: solved?, cost (USD est), tokens, requests, turns, tool calls,
   tiers used, wall-clock.

Output: a table to stdout + `bench/reports/<timestamp>.json` — the artifact you
diff across runs, tiers, and against Claude Code's own numbers.

## Run

```bash
bun run bench                     # whole suite, auto-route
bun run bench -- --tier code      # pin a tier
bun run bench -- --only fix-fizzbuzz
bun run bench -- --runs 3         # repeat each task, report pass-rate
bun run bench -- --from implement-lru-cache   # resume mid-suite (quota abort)
bun run bench -- --category bugfix            # one category only
```

Needs auth: `klaatai login` first, or `KLAATAI_API_KEY=...`.

The report JSON is written incrementally after every task — a mid-suite abort
(daily quota, ctrl-c) still leaves a usable partial report (`"complete": false`).

## Tasks (30)

Each task is a self-contained fixture dir with failing tests the agent must make
pass **without editing the test file**. Categories:

| category | count | what it exercises |
|----------|-------|-------------------|
| `bugfix` | 11 | find + fix a planted bug (off-by-one, mutation, async ordering, float money, regex escaping, unicode, shallow copy, state machine, …) |
| `implement` | 13 | implement a function/class from a stub + spec comment (LRU cache, event emitter, query string, JSON pointer, expression evaluator, …) |
| `multi-file` | 3 | the failing test is not where the fix is — cross-file navigation (implement imported module, bug in dependency, missing export) |
| `refactor` | 1 | behavior-preserving API change (callback → Promise) |
| `long-context` | 2 | large fixtures where navigation is the task: `longctx-cross-module-bug` (~30-file codebase, bug 3 modules from the failing test — exercises code-graph/search efficiency) and `longctx-shared-tax-rate` (wide mechanical fix across 8 feature modules) |

Difficulty spread: 10 easy · 16 medium · 4 hard (`implement-json-pointer`,
`implement-expression-eval`, `longctx-cross-module-bug`, plus multi-file navigation).

## Suite integrity — selfcheck (run after any task change)

```bash
bun run bench:selfcheck    # no agent, no tokens, fully local
```

For every task it verifies: (1) the fixture FAILS as shipped, and (2) it PASSES
with the reference solution from `bench/solutions/<id>/` overlaid. Both must
hold or the task is broken. CI-safe.

## Add a task

1. `mkdir bench/tasks/<id>/src`, add source + a `*.test.ts` that fails.
2. Add the reference solution under `bench/solutions/<id>/src/` (same relative
   paths — it is overlaid on the fixture).
3. Add an entry to `suite.json` (`id`, `dir`, `prompt`, `difficulty`, `category`).
4. `bun run bench:selfcheck` — must report ✓ for your task.

## Comparing against Claude Code

Run the same task prompts through Claude Code (or any agent) over the same
fixtures, capture its token/cost totals, and diff the two report JSONs. Keep the
fixture set identical so the only variable is the agent + routing.
