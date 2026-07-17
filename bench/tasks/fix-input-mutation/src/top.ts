// topThree(scores): return the three highest scores, highest first.
// Must NOT modify the input array. This implementation has a bug.
export function topThree(scores: number[]): number[] {
  return scores.sort((a, b) => b - a).slice(0, 3);
}
