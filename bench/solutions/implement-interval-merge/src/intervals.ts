export function mergeIntervals(intervals: [number, number][]): [number, number][] {
  if (!intervals.length) return [];
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [[sorted[0]![0], sorted[0]![1]]];
  for (let i = 1; i < sorted.length; i++) {
    const [start, end] = sorted[i]!;
    const last = out[out.length - 1]!;
    if (start <= last[1]) last[1] = Math.max(last[1], end);
    else out.push([start, end]);
  }
  return out;
}
