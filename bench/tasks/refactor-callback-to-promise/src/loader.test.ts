import { expect, test } from "bun:test";
// @ts-expect-error — loader.ts still has the legacy callback signature; the
// refactor goal is to make this Promise-based usage compile and pass.
import { loadUsers } from "./loader.js";

test("resolves with names", async () => {
  const names = await loadUsers(() => '[{"name":"ada"},{"name":"lin"}]');
  expect(names).toEqual(["ada", "lin"]);
});
test("resolves empty list", async () => {
  const names = await loadUsers(() => "[]");
  expect(names).toEqual([]);
});
test("rejects on invalid json", async () => {
  await expect(loadUsers(() => "not json")).rejects.toBeInstanceOf(Error);
});
