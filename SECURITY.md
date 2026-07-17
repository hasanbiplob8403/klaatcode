# Security Policy

Klaat Code runs shell commands and edits files on your machine, and talks to your KlaatAI account over the network — we take vulnerabilities here seriously.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Email **issues@klaatai.com** with:
- A description of the vulnerability and its impact
- Steps to reproduce (a minimal repro is very helpful)
- The version (`klaatcode --version`) and platform you found it on

We'll acknowledge within 48 hours and aim to have a fix or mitigation plan within 7 days for high-severity issues. We'll credit you in the release notes unless you'd rather stay anonymous.

## Scope

In scope:
- The Klaat Code CLI client in this repository (tool execution, sandboxing, permission model, credential storage, MCP/plugin loading, auth flows)
- The public API contract between the CLI and Klaatu (`X-KlaatAI-*` headers, `/v1/chat/completions`) as it affects client-side handling

Out of scope (report to the relevant channel instead, or note it and we'll route it):
- The Klaatu routing service itself (closed-source, backend) — email issues@klaatai.com and we'll route it internally
- Third-party MCP servers you've connected — that's between you and the server author
- Vulnerabilities requiring physical access to an already-compromised machine

## What "sensitive" means here

- `~/.klaatai/credentials.json` (auth tokens) and `~/.klaatai/mcp-oauth.json` (remote MCP tokens) are written with `0600` permissions — a bug that weakens this is a valid report.
- The write sandbox (project directory confinement + hard-denied system paths) is a security boundary — a bypass is a valid report.
- The permission-prompt system (allow-once/session/always/deny) not actually gating a dangerous tool call is a valid report.

## Known-safe by design

- The Supabase anon key in `src/auth/refresh.ts` is intentionally public (Supabase anon keys are meant to be client-side; access is enforced by Row Level Security server-side). This is not a vulnerability.
