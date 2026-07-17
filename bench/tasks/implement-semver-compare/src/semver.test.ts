import { expect, test } from "bun:test";
import { compareVersions } from "./semver.js";

test("equal", () => { expect(compareVersions("1.2.3", "1.2.3")).toBe(0); });
test("numeric not lexicographic", () => { expect(compareVersions("1.10.0", "1.9.0")).toBe(1); });
test("less than", () => { expect(compareVersions("0.9.9", "1.0.0")).toBe(-1); });
test("missing parts are zero", () => { expect(compareVersions("1.2", "1.2.0")).toBe(0); });
test("patch difference", () => { expect(compareVersions("2.0.1", "2.0.0")).toBe(1); });
test("minor beats patch", () => { expect(compareVersions("1.3.0", "1.2.9")).toBe(1); });
