/**
 * Local SQLite code-graph store — mirrors Desktop/VS Code graph-db schema.
 * Uses bun:sqlite (built into Bun, works in compiled binaries, no native addon).
 *
 * The local DB is a CACHE of server graph data, populated only when server
 * indexing succeeds (Pro+ plan).  Free users never accumulate data here.
 * Queries fall back to this cache on 5xx/network errors so Pro users stay
 * productive offline.
 */

import { homedir } from "node:os";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

// bun:sqlite is built into Bun — available in all compiled binaries.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — bun:sqlite is not in @types/bun yet on some versions
import { Database } from "bun:sqlite";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import type { Database as BunDatabase } from "bun:sqlite";

export interface LocalSymbol {
  name: string;
  kind: string;
  file: string;
  line: number;
  is_exported: number;
  signature?: string | null;
  callers?: string[];
  callees?: string[];
}

export interface LocalCaller {
  callerName: string;
  callerFile: string;
  hop: number;
}

export interface LocalStats {
  fileCount: number;
  symbolCount: number;
  edgeCount: number;
  embeddedCount: number;
  indexedAt: number | null;
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _db: BunDatabase | null = null;

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initLocalDb(): void {
  try {
    const dir = join(homedir(), ".klaatai", "graph");
    mkdirSync(dir, { recursive: true });
    const dbPath = join(dir, "KlaatAi.db");
    _db = new Database(dbPath);
    _db.exec("PRAGMA journal_mode = WAL");
    _db.exec("PRAGMA synchronous = NORMAL");
    _db.exec("PRAGMA foreign_keys = ON");
    _initSchema();
  } catch (e) {
    console.error("[klaatai local-db] init failed — local graph disabled:", e);
    _db = null;
  }
}

function _initSchema(): void {
  if (!_db) return;
  _db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id         TEXT    PRIMARY KEY,
      name       TEXT    NOT NULL,
      root_path  TEXT    NOT NULL,
      git_remote TEXT,
      indexed_at INTEGER NOT NULL,
      file_count INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS files (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT    NOT NULL,
      path       TEXT    NOT NULL,
      language   TEXT,
      hash       TEXT    NOT NULL,
      indexed_at INTEGER NOT NULL,
      UNIQUE(project_id, path)
    );
    CREATE TABLE IF NOT EXISTS symbols (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id     INTEGER NOT NULL,
      project_id  TEXT    NOT NULL,
      name        TEXT    NOT NULL,
      kind        TEXT    NOT NULL,
      start_line  INTEGER NOT NULL,
      end_line    INTEGER,
      is_exported INTEGER NOT NULL DEFAULT 0,
      signature   TEXT,
      FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS edges (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT    NOT NULL,
      from_sym   TEXT    NOT NULL,
      from_file  TEXT    NOT NULL,
      to_sym     TEXT    NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sym_proj   ON symbols(project_id);
    CREATE INDEX IF NOT EXISTS idx_sym_name   ON symbols(name, project_id);
    CREATE INDEX IF NOT EXISTS idx_sym_file   ON symbols(file_id);
    CREATE INDEX IF NOT EXISTS idx_file_proj  ON files(project_id);
    CREATE INDEX IF NOT EXISTS idx_edge_proj  ON edges(project_id, from_sym);
    CREATE INDEX IF NOT EXISTS idx_edge_to    ON edges(project_id, to_sym);
  `);
  // Migrate older DBs that are missing the signature column.
  try { _db.exec("ALTER TABLE symbols ADD COLUMN signature TEXT"); } catch {}
  try { _db.exec("ALTER TABLE symbols ADD COLUMN embedding BLOB"); } catch {}
}

// ─── Read operations ──────────────────────────────────────────────────────────

export function localDbIsIndexed(projectId: string): boolean {
  if (!_db) return false;
  return !!(_db.prepare("SELECT 1 FROM projects WHERE id = ?").get(projectId));
}

export function localDbDiff(
  projectId: string,
  files: Array<{ path: string; hash: string }>,
): string[] {
  if (!_db) return files.map((f) => f.path);
  const stmt = _db.prepare("SELECT hash FROM files WHERE project_id = ? AND path = ?");
  return files
    .filter((f) => {
      const row = stmt.get(projectId, f.path) as { hash: string } | undefined;
      return !row || row.hash !== f.hash;
    })
    .map((f) => f.path);
}

export function localDbQuery(
  projectId: string,
  query: string,
  kind: string | undefined,
  limit: number,
): LocalSymbol[] {
  if (!_db) return [];
  const kindClause = kind ? " AND s.kind = ?" : "";
  const kindParams: unknown[] = kind ? [kind] : [];
  const like = `%${query}%`;
  const rows = _db
    .prepare(
      `SELECT s.name, s.kind, f.path AS file, s.start_line AS line, s.is_exported, s.signature
       FROM symbols s
       JOIN files f ON f.id = s.file_id
       WHERE s.project_id = ?${kindClause}
         AND (s.name LIKE ? OR f.path LIKE ?)
       ORDER BY
         CASE WHEN s.name = ?    THEN 0
              WHEN s.name LIKE ? THEN 1
              ELSE                    2 END,
         s.name
       LIMIT ?`,
    )
    .all(projectId, ...kindParams, like, like, query, `${query}%`, limit) as LocalSymbol[];

  if (rows.length === 0) return rows;

  // Enrich with caller / callee names from the edges table.
  const callerStmt = _db.prepare(
    "SELECT DISTINCT from_sym FROM edges WHERE project_id = ? AND to_sym = ? LIMIT 10",
  );
  const calleeStmt = _db.prepare(
    "SELECT DISTINCT to_sym FROM edges WHERE project_id = ? AND from_sym = ? LIMIT 10",
  );
  return rows.map((sym) => ({
    ...sym,
    callers: (callerStmt.all(projectId, sym.name) as { from_sym: string }[]).map((r) => r.from_sym),
    callees: (calleeStmt.all(projectId, sym.name) as { to_sym: string }[]).map((r) => r.to_sym),
  }));
}

export function localDbFileSymbols(projectId: string, filePath: string): LocalSymbol[] {
  if (!_db) return [];
  return _db
    .prepare(
      `SELECT s.name, s.kind, f.path AS file, s.start_line AS line, s.is_exported, s.signature
       FROM symbols s
       JOIN files f ON f.id = s.file_id
       WHERE s.project_id = ? AND f.path = ?
       ORDER BY s.start_line`,
    )
    .all(projectId, filePath) as LocalSymbol[];
}

/** BFS over the edges table — who calls `symbolName`, up to `maxHops` hops. */
export function localDbCallers(
  projectId: string,
  symbolName: string,
  maxHops = 3,
): LocalCaller[] {
  if (!_db) return [];
  const stmt = _db.prepare(
    "SELECT DISTINCT from_sym, from_file FROM edges WHERE project_id = ? AND to_sym = ?",
  );
  const visited = new Set<string>([symbolName]);
  const results: LocalCaller[] = [];
  let frontier = [symbolName];

  for (let hop = 1; hop <= maxHops && frontier.length > 0; hop++) {
    const next: string[] = [];
    for (const sym of frontier) {
      for (const row of stmt.all(projectId, sym) as { from_sym: string; from_file: string }[]) {
        if (!visited.has(row.from_sym)) {
          visited.add(row.from_sym);
          results.push({ callerName: row.from_sym, callerFile: row.from_file, hop });
          next.push(row.from_sym);
        }
      }
    }
    frontier = next;
  }
  return results;
}

export function localDbGetStats(projectId: string): LocalStats {
  if (!_db) return { fileCount: 0, symbolCount: 0, edgeCount: 0, embeddedCount: 0, indexedAt: null };
  const proj = _db
    .prepare("SELECT file_count, indexed_at FROM projects WHERE id = ?")
    .get(projectId) as { file_count: number; indexed_at: number } | undefined;
  const { sc } = _db
    .prepare("SELECT COUNT(*) AS sc FROM symbols WHERE project_id = ?")
    .get(projectId) as { sc: number };
  const { ec } = _db
    .prepare("SELECT COUNT(*) AS ec FROM edges   WHERE project_id = ?")
    .get(projectId) as { ec: number };
  let embc = 0;
  try {
    const r = _db
      .prepare("SELECT COUNT(*) AS embc FROM symbols WHERE project_id = ? AND embedding IS NOT NULL")
      .get(projectId) as { embc: number };
    embc = r.embc;
  } catch { /* embedding column may not exist on very old DBs */ }
  return {
    fileCount: proj?.file_count ?? 0,
    symbolCount: sc,
    edgeCount: ec,
    embeddedCount: embc,
    indexedAt: proj?.indexed_at ?? null,
  };
}

// ─── Write operations ─────────────────────────────────────────────────────────

export function localDbIndexFiles(
  projectId: string,
  projectName: string,
  rootPath: string,
  gitRemote: string | null,
  files: Array<{
    path: string;
    language: string;
    hash: string;
    symbols: Array<{
      name: string; kind: string; start_line: number; end_line: number;
      is_exported: boolean; signature?: string;
    }>;
  }>,
): void {
  if (!_db || files.length === 0) return;
  const now = Date.now();

  const upsertFile = _db.prepare(
    `INSERT INTO files(project_id,path,language,hash,indexed_at) VALUES(?,?,?,?,?)
     ON CONFLICT(project_id,path) DO UPDATE SET
       hash=excluded.hash, language=excluded.language, indexed_at=excluded.indexed_at`,
  );
  const getFileId  = _db.prepare("SELECT id FROM files WHERE project_id = ? AND path = ?");
  const delSymbols = _db.prepare("DELETE FROM symbols WHERE file_id = ?");
  const insSymbol  = _db.prepare(
    "INSERT INTO symbols(file_id,project_id,name,kind,start_line,end_line,is_exported,signature) VALUES(?,?,?,?,?,?,?,?)",
  );
  const countFiles = _db.prepare("SELECT COUNT(*) AS c FROM files WHERE project_id = ?");
  const upsertProj = _db.prepare(
    `INSERT INTO projects(id,name,root_path,git_remote,indexed_at,file_count) VALUES(?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, root_path=excluded.root_path, git_remote=excluded.git_remote,
       indexed_at=excluded.indexed_at, file_count=excluded.file_count`,
  );

  // Single WAL transaction per batch.
  _db.transaction(() => {
    for (const f of files) {
      upsertFile.run(projectId, f.path, f.language, f.hash, now);
      const row = getFileId.get(projectId, f.path) as { id: number } | undefined;
      if (!row) continue;
      delSymbols.run(row.id);
      for (const s of f.symbols) {
        insSymbol.run(
          row.id, projectId, s.name, s.kind,
          s.start_line, s.end_line, s.is_exported ? 1 : 0, s.signature ?? null,
        );
      }
    }
    const { c } = countFiles.get(projectId) as { c: number };
    upsertProj.run(projectId, projectName, rootPath, gitRemote, now, c);
  })();
}

export function localDbIndexEdges(
  projectId: string,
  changedFilePaths: string[],
  edges: Array<{ from: string; fromFile: string; to: string }>,
): void {
  if (!_db || changedFilePaths.length === 0) return;
  const del = _db.prepare("DELETE FROM edges WHERE project_id = ? AND from_file = ?");
  const ins = _db.prepare("INSERT INTO edges(project_id,from_sym,from_file,to_sym) VALUES(?,?,?,?)");
  _db.transaction(() => {
    for (const fp of changedFilePaths) del.run(projectId, fp);
    for (const e of edges) ins.run(projectId, e.from, e.fromFile, e.to);
  })();
}

// ─── Semantic search (embedding) ─────────────────────────────────────────────

export function localDbGetSymbolsForEmbedding(
  projectId: string,
  filePaths: string[],
): Array<{ id: number; name: string; kind: string; file: string; signature: string | null }> {
  if (!_db || filePaths.length === 0) return [];
  const placeholders = filePaths.map(() => "?").join(",");
  return _db.prepare(`
    SELECT s.id, s.name, s.kind, f.path AS file, s.signature
    FROM symbols s JOIN files f ON f.id = s.file_id
    WHERE s.project_id = ? AND f.path IN (${placeholders})
    ORDER BY f.path, s.start_line
  `).all(projectId, ...filePaths) as Array<{ id: number; name: string; kind: string; file: string; signature: string | null }>;
}

export function localDbGetUnembeddedSymbols(
  projectId: string,
): Array<{ id: number; name: string; kind: string; file: string; signature: string | null }> {
  if (!_db) return [];
  return _db.prepare(`
    SELECT s.id, s.name, s.kind, f.path AS file, s.signature
    FROM symbols s JOIN files f ON f.id = s.file_id
    WHERE s.project_id = ? AND s.embedding IS NULL
    ORDER BY f.path, s.start_line
  `).all(projectId) as Array<{ id: number; name: string; kind: string; file: string; signature: string | null }>;
}

export function localDbWriteEmbeddings(rows: Array<{ id: number; embedding: Float32Array }>): void {
  if (!_db || rows.length === 0) return;
  const stmt = _db.prepare("UPDATE symbols SET embedding = ? WHERE id = ?");
  _db.transaction(() => {
    for (const { id, embedding } of rows) {
      stmt.run(Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength), id);
    }
  })();
}

export function localDbSemanticSearch(
  projectId: string,
  queryEmbedding: Float32Array,
  limit: number,
): Array<{ name: string; kind: string; file: string; line: number; score: number }> {
  if (!_db) return [];
  const rows = _db.prepare(`
    SELECT s.name, s.kind, s.start_line AS line, s.embedding, f.path AS file
    FROM symbols s JOIN files f ON f.id = s.file_id
    WHERE s.project_id = ? AND s.embedding IS NOT NULL
  `).all(projectId) as Array<{ name: string; kind: string; line: number; embedding: Buffer; file: string }>;

  if (rows.length === 0) return [];

  const scored = rows.map((r) => {
    const vec = new Float32Array(r.embedding.buffer, r.embedding.byteOffset, r.embedding.byteLength / 4);
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < vec.length; i++) {
      dot  += queryEmbedding[i] * vec[i];
      magA += queryEmbedding[i] * queryEmbedding[i];
      magB += vec[i] * vec[i];
    }
    const score = magA > 0 && magB > 0 ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0;
    return { name: r.name, kind: r.kind, file: r.file, line: r.line, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .filter((r) => r.score > 0.30);
}
