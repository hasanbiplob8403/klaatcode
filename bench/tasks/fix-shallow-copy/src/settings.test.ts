import { expect, test } from "bun:test";
import { withTheme } from "./settings.js";

test("returns updated theme", () => {
  const base = { ui: { theme: "light", font: "mono" }, version: 2 };
  expect(withTheme(base, "dark").ui.theme).toBe("dark");
});
test("original config is untouched", () => {
  const base = { ui: { theme: "light", font: "mono" }, version: 2 };
  withTheme(base, "dark");
  expect(base.ui.theme).toBe("light");
});
test("other fields preserved", () => {
  const base = { ui: { theme: "light", font: "mono" }, version: 2 };
  const next = withTheme(base, "dark");
  expect(next.ui.font).toBe("mono");
  expect(next.version).toBe(2);
});
