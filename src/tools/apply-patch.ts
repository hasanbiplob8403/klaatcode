/**
 * apply_patch — envelope diff format (Add / Update / Delete / Move File),
 * applied atomically across multiple files in one tool call.
 *
 *   *** Begin Patch
 *   *** Add File: path/new.ts
 *   +line
 *   *** Update File: path/existing.ts
 *   *** Move to: path/renamed.ts        (optional)
 *   @@ optional context header
 *    unchanged context line
 *   -removed line
 *   +added line
 *   *** Delete File: path/old.ts
 *   *** End Patch
 *
 * Update hunks are applied through the fuzzy edit engine, so slightly-off
 * context still lands. Parse-only here; file IO + sandbox/freshness live in the
 * tool wrapper (index.ts) so validation stays in one place.
 */

export interface PatchHunk { oldStr: string; newStr: string }
export type PatchOp =
  | { type: "add"; path: string; content: string }
  | { type: "delete"; path: string }
  | { type: "update"; path: string; moveTo?: string; hunks: PatchHunk[] };

export type ParseResult = { ok: true; ops: PatchOp[] } | { ok: false; error: string };

export function parsePatch(text: string): ParseResult {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  // Tolerate leading blank lines.
  while (i < lines.length && lines[i]!.trim() === "") i++;
  if (i >= lines.length || !lines[i]!.startsWith("*** Begin Patch")) {
    return { ok: false, error: "Patch must start with '*** Begin Patch'." };
  }
  i++;

  const ops: PatchOp[] = [];
  const isHeader = (l: string) => l.startsWith("*** ");

  while (i < lines.length) {
    const line = lines[i]!;
    if (line.startsWith("*** End Patch")) return { ok: true, ops };
    if (line.trim() === "") { i++; continue; }

    const add = line.match(/^\*\*\* Add File: (.+)$/);
    const del = line.match(/^\*\*\* Delete File: (.+)$/);
    const upd = line.match(/^\*\*\* Update File: (.+)$/);

    if (add) {
      i++;
      const body: string[] = [];
      while (i < lines.length && !isHeader(lines[i]!)) {
        const l = lines[i]!;
        body.push(l.startsWith("+") ? l.slice(1) : l);
        i++;
      }
      ops.push({ type: "add", path: add[1]!.trim(), content: body.join("\n") });
      continue;
    }
    if (del) {
      ops.push({ type: "delete", path: del[1]!.trim() });
      i++;
      continue;
    }
    if (upd) {
      const path = upd[1]!.trim();
      i++;
      let moveTo: string | undefined;
      const mv = lines[i]?.match(/^\*\*\* Move to: (.+)$/);
      if (mv) { moveTo = mv[1]!.trim(); i++; }

      const hunks: PatchHunk[] = [];
      let oldBuf: string[] = [], newBuf: string[] = [];
      const flush = () => {
        if (oldBuf.length || newBuf.length) hunks.push({ oldStr: oldBuf.join("\n"), newStr: newBuf.join("\n") });
        oldBuf = []; newBuf = [];
      };
      while (i < lines.length && !isHeader(lines[i]!)) {
        const l = lines[i]!;
        if (l.startsWith("@@")) { flush(); i++; continue; }
        if (l.startsWith("-"))      oldBuf.push(l.slice(1));
        else if (l.startsWith("+")) newBuf.push(l.slice(1));
        else { const c = l.startsWith(" ") ? l.slice(1) : l; oldBuf.push(c); newBuf.push(c); }
        i++;
      }
      flush();
      if (hunks.length === 0) return { ok: false, error: `Update File ${path} has no hunks.` };
      ops.push({ type: "update", path, moveTo, hunks });
      continue;
    }

    return { ok: false, error: `Unexpected line in patch: "${line.slice(0, 60)}"` };
  }
  return { ok: false, error: "Patch missing '*** End Patch'." };
}
