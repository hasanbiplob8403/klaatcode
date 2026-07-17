# Contributing to Klaat Code

Thanks for considering a contribution. This client is open source; the Klaatu routing engine and model catalog it talks to are not — see the README's "What is Klaatu?" section if you're wondering where the line is.

## Dev setup

Requires [Bun](https://bun.sh) ≥ 1.0.

```bash
git clone https://github.com/KlaatAI/klaatcode.git
cd klaatcode
bun install
bun run dev              # runs the TUI from source
```

Point it at a local or staging Klaatu instance with `--base-url`, or use the production endpoint (`https://api.klaatai.com`, the default) against your own KlaatAI account.

## Before opening a PR

```bash
bun run typecheck
bun test
bun run bench:selfcheck   # if you touched anything under bench/
bun run build
```

All four must pass — CI runs the same checks on every PR. If you added a tool, a slash command, or a config key, update the relevant section in `README.md` and the docs at [klaatai.com/docs](https://klaatai.com/docs) (source lives in the `website` and `KlaatAi.Klaatu.UI` sync — flag in your PR description if you're not sure where, a maintainer will route the docs change).

## What we're looking for

- Bug fixes with a repro (a failing test is ideal)
- New tools or slash commands that don't require server-side changes (the CLI can't add routing/quota/pricing features on its own — those live in Klaatu)
- MCP, hooks, skills, and plugin ecosystem improvements
- Bench task additions (new fixtures in `bench/tasks/`) — these directly extend the reproducible benchmark story, always welcome
- Terminal UI polish, theme additions, accessibility fixes

## What's probably out of scope

- Anything requiring a change to the Klaatu API contract — open an issue to discuss first, since it needs a corresponding server-side change we control
- Rebranding or forking the identity (see the trademark note in `LICENSE`) — fork away, just don't call it Klaat Code

## Commit style

Conventional-ish: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:` prefixes. Keep the subject line under ~70 chars; explain *why* in the body when it's not obvious from the diff.

## Code style

- No comments that just restate what the code does — only ones that explain a non-obvious *why*.
- Match existing patterns (persona-as-data, tool registration in `src/tools/index.ts`, permission summaries in `src/permissions/index.ts`) rather than introducing a new one for a single feature.
- Run `bun run typecheck` before pushing — CI will reject a red build.

## Reporting bugs vs vulnerabilities

Bugs: open a GitHub issue with repro steps. Security vulnerabilities: **do not** open a public issue — see [SECURITY.md](SECURITY.md).
