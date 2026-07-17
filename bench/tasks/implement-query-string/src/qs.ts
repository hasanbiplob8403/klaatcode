// parseQuery(qs): parse a URL query string (no leading "?") into an object.
// - "a=1&b=2"          → { a: "1", b: "2" }
// - repeated keys      → array in order: "t=x&t=y" → { t: ["x", "y"] }
// - keys and values are percent-decoded; "+" decodes to a space
// - a key with no "="  → value ""
// - empty input        → {}
// TODO: not implemented yet.
export function parseQuery(_qs: string): Record<string, string | string[]> {
  return {};
}
