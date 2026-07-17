/**
 * Compact diff builder for edit/write tool displays.
 *
 * Produces a small unified-diff hunk (removed lines then added lines, with a
 * little surrounding context) for showing in the transcript and the permission
 * prompt. Display-only — never sent to the model.
 */

export interface DiffLine { sign: "+" | "-" | " "; text: string; ln?: number }

const MAX_LINES = 24;

/**
 * Diff two strings (an edit's old_string → new_string).
 * `startLine` (1-based file line of the hunk) enables gutter line numbers.
 */
export function buildEditDiff(oldStr: string, newStr: string, startLine?: number): DiffLine[] {
  const oldLines = oldStr.split("\n");
  const newLines = newStr.split("\n");

  // Trim common prefix/suffix lines so the hunk focuses on the change.
  let pre = 0;
  while (pre < oldLines.length && pre < newLines.length && oldLines[pre] === newLines[pre]) pre++;
  let suf = 0;
  while (
    suf < oldLines.length - pre &&
    suf < newLines.length - pre &&
    oldLines[oldLines.length - 1 - suf] === newLines[newLines.length - 1 - suf]
  ) suf++;

  const ctx = 1; // lines of surrounding context to keep
  const preStart = Math.max(0, pre - ctx);
  const base = startLine;
  const num = (i: number): number | undefined => base === undefined ? undefined : base + i;

  const out: DiffLine[] = [];
  for (let i = preStart; i < pre; i++) out.push({ sign: " ", text: oldLines[i]!, ln: num(i) });
  for (let i = pre; i < oldLines.length - suf; i++) out.push({ sign: "-", text: oldLines[i]!, ln: num(i) });
  for (let i = pre; i < newLines.length - suf; i++) out.push({ sign: "+", text: newLines[i]!, ln: num(i) });
  const sufEnd = Math.min(oldLines.length, oldLines.length - suf + ctx);
  for (let i = oldLines.length - suf; i < sufEnd; i++) out.push({ sign: " ", text: oldLines[i]!, ln: num(i) });

  return cap(out);
}

/** Diff for multi_edit — concatenated hunks. */
export function buildMultiEditDiff(edits: { old_string: string; new_string: string }[]): DiffLine[] {
  const out: DiffLine[] = [];
  for (let i = 0; i < edits.length; i++) {
    if (i > 0) out.push({ sign: " ", text: "" });
    out.push(...buildEditDiff(edits[i]!.old_string, edits[i]!.new_string));
  }
  return cap(out);
}

/** Diff for a freshly written file — all added lines, numbered from 1. */
export function buildWriteDiff(content: string): DiffLine[] {
  return cap(content.split("\n").map((l, i) => ({ sign: "+" as const, text: l, ln: i + 1 })));
}

/** Diff for an apply_patch envelope — per-file header rows then hunk diffs. */
export function buildPatchDiff(
  ops: import("../tools/apply-patch.js").PatchOp[],
): DiffLine[] {
  const out: DiffLine[] = [];
  for (const op of ops) {
    if (out.length > 0) out.push({ sign: " ", text: "" });
    if (op.type === "add") {
      out.push({ sign: " ", text: `── add ${op.path}` });
      out.push(...op.content.split("\n").map((l, i) => ({ sign: "+" as const, text: l, ln: i + 1 })));
    } else if (op.type === "delete") {
      out.push({ sign: " ", text: `── delete ${op.path}` });
      out.push({ sign: "-", text: "(file deleted)" });
    } else {
      out.push({ sign: " ", text: `── update ${op.path}${op.moveTo ? ` → ${op.moveTo}` : ""}` });
      for (const h of op.hunks) out.push(...buildEditDiff(h.oldStr, h.newStr));
    }
  }
  return cap(out);
}

/** 1-based line number where `needle`'s first line begins in `haystack`, or undefined. */
export function lineOf(haystack: string, needle: string): number | undefined {
  const firstLine = needle.split("\n")[0] ?? "";
  const idx = haystack.indexOf(needle);
  if (idx === -1) {
    // fall back to matching just the first line
    const li = haystack.indexOf(firstLine);
    if (li === -1) return undefined;
    return haystack.slice(0, li).split("\n").length;
  }
  return haystack.slice(0, idx).split("\n").length;
}

function cap(lines: DiffLine[]): DiffLine[] {
  if (lines.length <= MAX_LINES) return lines;
  const kept = lines.slice(0, MAX_LINES);
  kept.push({ sign: " ", text: `… ${lines.length - MAX_LINES} more line(s)` });
  return kept;
}

/** Additions/deletions count for a summary badge. */
export function diffStat(lines: DiffLine[]): { add: number; del: number } {
  let add = 0, del = 0;
  for (const l of lines) { if (l.sign === "+") add++; else if (l.sign === "-") del++; }
  return { add, del };
}
