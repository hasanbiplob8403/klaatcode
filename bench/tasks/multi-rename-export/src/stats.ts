import { average, median } from "./math-utils.js";

// summarize(xs): dashboard summary of a numeric series.
// This file is the CONSUMER contract — do not edit it.
export function summarize(xs: number[]): { average: number; median: number } {
  return { average: average(xs), median: median(xs) };
}
