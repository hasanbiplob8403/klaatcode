import { expect, test } from "bun:test";
import { weatherReport } from "./weather.js";

test("boiling point", () => { expect(weatherReport("Pune", 100)).toBe("Pune: 100°C (212°F)"); });
test("freezing point", () => { expect(weatherReport("Oslo", 0)).toBe("Oslo: 0°C (32°F)"); });
test("body temperature", () => { expect(weatherReport("Goa", 37)).toBe("Goa: 37°C (99°F)"); });
