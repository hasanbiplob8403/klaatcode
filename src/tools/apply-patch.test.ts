import { expect, test, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parsePatch } from "./apply-patch.js";
import { executeTools, configureSandbox } from "./index.js";
import type { ToolCall } from "../api/client.js";

// ─── parsePatch unit tests ───────────────────────────────────────────────────

test("parsePatch: add file", () => {
  const r = parsePatch([
    "*** Begin Patch",
    "*** Add File: src/new.ts",
    "+export const x = 1;",
    "+export const y = 2;",
    "*** End Patch",
  ].join("\n"));
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(r.ops).toEqual([{ type: "add", path: "src/new.ts", content: "export const x = 1;\nexport const y = 2;" }]);
});

test("parsePatch: update with hunks split by @@ and context lines", () => {
  const r = parsePatch([
    "*** Begin Patch",
    "*** Update File: a.ts",
    "@@ first",
    " const keep = true;",
    "-const a = 1;",
    "+const a = 2;",
    "@@ second",
    "-old()",
    "+neu()",
    "*** End Patch",
  ].join("\n"));
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(r.ops).toHaveLength(1);
  const op = r.ops[0]!;
  if (op.type !== "update") throw new Error("expected update");
  expect(op.hunks).toEqual([
    { oldStr: "const keep = true;\nconst a = 1;", newStr: "const keep = true;\nconst a = 2;" },
    { oldStr: "old()", newStr: "neu()" },
  ]);
});

test("parsePatch: delete + move-to", () => {
  const r = parsePatch([
    "*** Begin Patch",
    "*** Update File: src/old-name.ts",
    "*** Move to: src/new-name.ts",
    "-a",
    "+b",
    "*** Delete File: src/dead.ts",
    "*** End Patch",
  ].join("\n"));
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(r.ops).toHaveLength(2);
  const upd = r.ops[0]!;
  if (upd.type !== "update") throw new Error("expected update");
  expect(upd.moveTo).toBe("src/new-name.ts");
  expect(r.ops[1]).toEqual({ type: "delete", path: "src/dead.ts" });
});

test("parsePatch: CRLF normalized", () => {
  const r = parsePatch("*** Begin Patch\r\n*** Add File: a.txt\r\n+hi\r\n*** End Patch\r\n");
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(r.ops[0]).toEqual({ type: "add", path: "a.txt", content: "hi" });
});

test("parsePatch errors: missing Begin, missing End, empty update, junk line", () => {
  expect(parsePatch("*** Add File: x\n+1").ok).toBe(false);
  expect(parsePatch("*** Begin Patch\n*** Add File: x\n+1").ok).toBe(false);
  expect(parsePatch("*** Begin Patch\n*** Update File: x\n*** End Patch").ok).toBe(false);
  expect(parsePatch("*** Begin Patch\n??? what\n*** End Patch").ok).toBe(false);
});

// ─── apply_patch integration through executeTools ────────────────────────────

let root: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "klaatai-apply-patch-"));
  configureSandbox({ enabled: true, root, allow: [] });
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function patchCall(patch: string): ToolCall {
  return {
    id: "t1",
    type: "function",
    function: { name: "apply_patch", arguments: JSON.stringify({ patch }) },
  } as ToolCall;
}

async function readTool(path: string): Promise<string> {
  return executeTools({
    id: "r1", type: "function",
    function: { name: "read_file", arguments: JSON.stringify({ path }) },
  } as ToolCall, root);
}

test("apply_patch: add + update + delete atomically", async () => {
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "src/app.ts"), "const version = 1;\nconsole.log(version);\n");
  writeFileSync(join(root, "src/dead.ts"), "gone\n");
  await readTool("src/app.ts"); // freshness: update requires prior read

  const res = await executeTools(patchCall([
    "*** Begin Patch",
    "*** Add File: src/util.ts",
    "+export const two = 2;",
    "*** Update File: src/app.ts",
    "-const version = 1;",
    "+const version = 2;",
    "*** Delete File: src/dead.ts",
    "*** End Patch",
  ].join("\n")), root);

  expect(res.startsWith("OK")).toBe(true);
  expect(readFileSync(join(root, "src/util.ts"), "utf-8")).toBe("export const two = 2;");
  expect(readFileSync(join(root, "src/app.ts"), "utf-8")).toContain("const version = 2;");
  expect(existsSync(join(root, "src/dead.ts"))).toBe(false);
});

test("apply_patch: move-to renames file with edit applied", async () => {
  writeFileSync(join(root, "src/old-name.ts"), "export const n = 1;\n");
  await readTool("src/old-name.ts");

  const res = await executeTools(patchCall([
    "*** Begin Patch",
    "*** Update File: src/old-name.ts",
    "*** Move to: src/new-name.ts",
    "-export const n = 1;",
    "+export const n = 9;",
    "*** End Patch",
  ].join("\n")), root);

  expect(res.startsWith("OK")).toBe(true);
  expect(existsSync(join(root, "src/old-name.ts"))).toBe(false);
  expect(readFileSync(join(root, "src/new-name.ts"), "utf-8")).toContain("n = 9");
});

test("apply_patch: failed hunk aborts whole patch (no partial writes)", async () => {
  writeFileSync(join(root, "src/target.ts"), "line one\n");
  await readTool("src/target.ts");

  const res = await executeTools(patchCall([
    "*** Begin Patch",
    "*** Add File: src/should-not-exist.ts",
    "+nope",
    "*** Update File: src/target.ts",
    "-this string is nowhere in the file at all",
    "+replacement",
    "*** End Patch",
  ].join("\n")), root);

  expect(res.startsWith("Error")).toBe(true);
  expect(existsSync(join(root, "src/should-not-exist.ts"))).toBe(false);
  expect(readFileSync(join(root, "src/target.ts"), "utf-8")).toBe("line one\n");
});

test("apply_patch: add refuses to overwrite existing file", async () => {
  writeFileSync(join(root, "exists.txt"), "here\n");
  const res = await executeTools(patchCall(
    "*** Begin Patch\n*** Add File: exists.txt\n+clobber\n*** End Patch",
  ), root);
  expect(res.startsWith("Error")).toBe(true);
  expect(readFileSync(join(root, "exists.txt"), "utf-8")).toBe("here\n");
});

test("apply_patch: update without prior read is refused (freshness)", async () => {
  writeFileSync(join(root, "unread.ts"), "const q = 1;\n");
  const res = await executeTools(patchCall(
    "*** Begin Patch\n*** Update File: unread.ts\n-const q = 1;\n+const q = 2;\n*** End Patch",
  ), root);
  expect(res.startsWith("Error")).toBe(true);
  expect(readFileSync(join(root, "unread.ts"), "utf-8")).toBe("const q = 1;\n");
});

test("apply_patch: write outside sandbox refused", async () => {
  const res = await executeTools(patchCall(
    "*** Begin Patch\n*** Add File: /tmp/definitely-outside-sandbox.txt\n+x\n*** End Patch",
  ), root);
  expect(res.startsWith("Error")).toBe(true);
});
