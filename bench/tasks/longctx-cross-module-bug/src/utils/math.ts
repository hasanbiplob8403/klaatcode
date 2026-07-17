export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
export function sum(ns: number[]): number {
  return ns.reduce((a, b) => a + b, 0);
}
// Decoy: rounding helper used by reporting, not by order totals.
export function roundTo(n: number, places: number): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}
