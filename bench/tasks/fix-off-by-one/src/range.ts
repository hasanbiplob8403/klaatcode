// sumRange(a, b): sum of all integers from a to b INCLUSIVE.
// This implementation is off by one — it excludes the upper bound.
export function sumRange(a: number, b: number): number {
  let total = 0;
  for (let i = a; i < b; i++) total += i;
  return total;
}
