/**
 * CLI Knowledge-graph indexer — runs silently in the background after login.
 *
 * Paywall model:
 *   - Server enforces plan check on /v1/graph/projects/{id}/index.
 *   - Free users get 403 → local DB never populated → graph tools degrade gracefully.
 *   - Pro users: server + local DB both populated.  Local is a reliability cache
 *     (offline / 5xx) — not a free-tier bypass.
 */

import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { readdirSync, statSync } from "node:fs";
import { resolveProjectId, type ProjectInfo } from "../utils/project-id.js";
import { extractSymbols, extractCallEdges } from "./regex-symbols.js";
import {
  localDbDiff, localDbIndexFiles, localDbIndexEdges,
  localDbGetSymbolsForEmbedding, localDbGetUnembeddedSymbols, localDbWriteEmbeddings,
} from "./local-db.js";
import { embedPassages } from "./code-embedder.js";
import type { KlaatAIClient } from "../api/client.js";

const FILE_BATCH = 40;
const GLOB_EXTS = new Set([
  "ts", "tsx", "js", "jsx", "mts", "cts", "mjs", "cjs",
  "py", "go", "rs", "java", "kt", "kts", "swift", "php", "rb", "cs",
  "c", "h", "cc", "cpp", "cxx", "hpp", "m", "mm",
  "vue", "svelte", "scala", "dart", "lua", "ex", "exs", "sh", "bash",
]);
const EXCLUDE_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", "out",
  "target", "vendor", "coverage", ".venv", "__pycache__",
]);

const LANG_BY_EXT: Record<string, string> = {
  ts: "typescript", tsx: "typescript", mts: "typescript", cts: "typescript",
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  py: "python", go: "go", rs: "rust", java: "java", kt: "kotlin", kts: "kotlin",
  swift: "swift", php: "php", rb: "ruby", cs: "csharp",
};

export type IndexStatus = "idle" | "scanning" | "indexing" | "done" | "error";

export interface IndexProgress {
  status: IndexStatus;
  indexed: number;
  total: number;
  projectFiles: number;
  symbols: number;
  edges: number;
  projectName?: string;
  message?: string;
}

type ProgressCallback = (p: IndexProgress) => void;

export class KGIndexer {
  private _client: KlaatAIClient;
  private _listeners: ProgressCallback[] = [];
  private _state: IndexProgress = { status: "idle", indexed: 0, total: 0, projectFiles: 0, symbols: 0, edges: 0 };
  private _running = false;
  private _lastRun = 0;

  constructor(client: KlaatAIClient) {
    this._client = client;
  }

  onProgress(cb: ProgressCallback): () => void {
    this._listeners.push(cb);
    return () => { this._listeners = this._listeners.filter((l) => l !== cb); };
  }

  get state(): IndexProgress { return this._state; }

  private _emit(patch: Partial<IndexProgress>): void {
    this._state = { ...this._state, ...patch };
    for (const cb of this._listeners) cb(this._state);
  }

  /** Index the workspace. Safe to call often — throttled to once/minute unless forced. */
  async indexWorkspace(projectRoot: string, force = false): Promise<void> {
    if (this._running) return;
    if (!force && Date.now() - this._lastRun < 60_000) return;

    const proj = resolveProjectId(projectRoot);
    if (!proj) return;

    this._running = true;
    this._lastRun = Date.now();
    this._emit({ status: "scanning", indexed: 0, total: 0, symbols: 0, projectFiles: 0, projectName: proj.name });

    try {
      const uris = _walkFiles(projectRoot);
      if (uris.length === 0) {
        this._emit({ status: "done", message: "No indexable files found" });
        return;
      }

      // Hash every file.
      const hashed: { relPath: string; absPath: string; hash: string }[] = [];
      for (const absPath of uris) {
        try {
          const bytes = readFileSync(absPath);
          hashed.push({
            absPath,
            relPath: relative(projectRoot, absPath),
            hash: createHash("sha256").update(bytes).digest("hex"),
          });
        } catch { /* unreadable — skip */ }
      }
      this._emit({ projectFiles: hashed.length });

      // Diff — local first, server fallback.
      let stalePaths: string[];
      if (force) {
        stalePaths = hashed.map((h) => h.relPath);
      } else {
        const localStale = localDbDiff(proj.id, hashed.map((h) => ({ path: h.relPath, hash: h.hash })));
        if (localStale.length < hashed.length) {
          stalePaths = localStale;
        } else {
          try {
            stalePaths = await this._client.graphDiff(
              proj.id,
              hashed.map((h) => ({ path: h.relPath, hash: h.hash })),
            );
          } catch {
            stalePaths = hashed.map((h) => h.relPath);
          }
        }
      }

      const staleSet = new Set(stalePaths);
      const stale = hashed.filter((h) => staleSet.has(h.relPath));

      if (stale.length === 0) {
        this._emit({ status: "done", indexed: 0, total: 0, message: `Up to date (${hashed.length} files)` });
        return;
      }

      this._emit({ status: "indexing", total: stale.length, indexed: 0 });
      let indexed = 0;
      let symbols = 0;

      const allBuilt: NonNullable<ReturnType<typeof _buildFile>>[] = [];
      for (let i = 0; i < stale.length; i += FILE_BATCH) {
        const batch = stale.slice(i, i + FILE_BATCH);
        const built = batch
          .map((f) => _buildFile(f.absPath, f.relPath, f.hash))
          .filter((f): f is NonNullable<typeof f> => f !== null);
        allBuilt.push(...built);

        const batchSymbols = built.reduce((n, f) => n + f.symbols.length, 0);

        // Write to local DB — single WAL transaction per batch.
        try {
          localDbIndexFiles(proj.id, proj.name, proj.rootPath, proj.gitRemote, built);
        } catch { /* non-fatal */ }

        // Upload to server — this is where the paywall fires.
        // 403 = not on Pro plan; local DB will still have data but server won't.
        const res = await this._client.graphIndex(proj.id, {
          project_name: proj.name,
          root_path: proj.rootPath,
          git_remote: proj.gitRemote,
          total_files: hashed.length,
          files: built,
        });

        if (res.ok) {
          indexed += batch.length;
          symbols += batchSymbols;
        } else if (res.status === 403 || res.status === 402) {
          // Plan gate — stop indexing, don't retry.
          this._emit({
            status: "error",
            message: "Graph indexing requires a Pro plan — upgrade at klaatai.com/pricing",
          });
          return;
        }
        // Other errors (5xx) — continue with remaining batches.

        this._emit({ indexed, symbols, message: `Indexed ${indexed} of ${stale.length} file(s)` });
      }

      // Build call-graph edges from the already-parsed files (no re-parse).
      const localEdges: { from: string; fromFile: string; to: string }[] = [];
      const serverEdges: { from_name: string; from_file: string; to_name: string; to_file: string; kind: string; source: string }[] = [];
      for (const b of allBuilt) {
        for (const [caller, callees] of Object.entries(b.calls ?? {})) {
          for (const callee of callees) {
            localEdges.push({ from: caller, fromFile: b.path, to: callee });
            serverEdges.push({ from_name: caller, from_file: b.path, to_name: callee, to_file: "", kind: "calls", source: "regex" });
          }
        }
      }
      let edgeCount = 0;
      if (localEdges.length > 0) {
        try {
          localDbIndexEdges(proj.id, allBuilt.map((b) => b.path), localEdges);
          edgeCount = localEdges.length;
        } catch { /* non-fatal */ }
        // Push to server /edges in capped batches (best-effort; ignores paywall).
        try {
          for (let i = 0; i < serverEdges.length; i += 200) {
            await this._client.graphEdges(proj.id, serverEdges.slice(i, i + 200));
          }
        } catch { /* non-fatal */ }
      }

      this._emit({ status: "done", indexed, total: stale.length, symbols, edges: edgeCount, message: `Indexed ${indexed} file(s), ${symbols} symbol(s), ${edgeCount} edge(s)` });

      // Fire-and-forget embedding pass (non-blocking)
      void this._embedChangedSymbols(proj.id, allBuilt.map((b) => b.path));
    } catch (e) {
      this._emit({ status: "error", message: `Indexing failed: ${String(e)}` });
    } finally {
      this._running = false;
    }
  }

  private async _embedChangedSymbols(projectId: string, changedFilePaths: string[]): Promise<void> {
    try {
      const token = this._client.token;
      const serverUrl = this._client.serverUrl;

      const fromChanged = changedFilePaths.length > 0
        ? localDbGetSymbolsForEmbedding(projectId, changedFilePaths) : [];
      const unembedded = localDbGetUnembeddedSymbols(projectId);
      const seen = new Set<number>(fromChanged.map((s) => s.id));
      const syms = [...fromChanged, ...unembedded.filter((s) => !seen.has(s.id))];
      if (syms.length === 0) return;

      const texts = syms.map((s) =>
        `${s.kind} ${s.name} (${s.file})${s.signature ? ": " + s.signature.slice(0, 200) : ""}`
      );
      const embeddings = await embedPassages(texts, token, serverUrl);
      const toWrite = syms
        .map((s, i) => ({ id: s.id, embedding: embeddings[i] }))
        .filter((r) => r.embedding instanceof Float32Array);
      localDbWriteEmbeddings(toWrite);
    } catch {
      // Embedding failure is non-fatal — structural graph still works
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _walkFiles(dir: string): string[] {
  const results: string[] = [];
  function walk(d: string): void {
    let entries: string[];
    try { entries = readdirSync(d); } catch { return; }
    for (const e of entries) {
      if (e.startsWith(".") && e !== ".klaatai") continue;
      const full = join(d, e);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) {
        if (!EXCLUDE_DIRS.has(e)) walk(full);
      } else {
        const ext = e.split(".").pop()?.toLowerCase() ?? "";
        if (GLOB_EXTS.has(ext)) results.push(full);
      }
    }
  }
  walk(dir);
  return results;
}

function _buildFile(
  absPath: string,
  relPath: string,
  hash: string,
): { path: string; language: string; hash: string; symbols: ReturnType<typeof extractSymbols>; calls: Record<string, string[]> } | null {
  const ext = relPath.split(".").pop()?.toLowerCase() ?? "";
  const language = LANG_BY_EXT[ext] ?? ext;
  try {
    const text = readFileSync(absPath, "utf-8");
    const symbols = extractSymbols(language, ext, text);
    const calls = extractCallEdges(text, symbols);
    return { path: relPath, language, hash, symbols, calls };
  } catch {
    return { path: relPath, language, hash, symbols: [], calls: {} };
  }
}
