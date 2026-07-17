// truncate(s, max): if s has more than max characters (counting emoji /
// astral symbols as ONE character), cut to max characters and append "…".
// Otherwise return s unchanged. This implementation has a bug with
// characters outside the Basic Multilingual Plane (e.g. emoji).
export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}
