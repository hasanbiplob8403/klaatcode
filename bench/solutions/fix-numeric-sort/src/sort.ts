export function sortScores(xs: number[]): number[] {
  return [...xs].sort((a, b) => a - b);
}
