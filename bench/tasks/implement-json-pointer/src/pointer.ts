// getByPointer(doc, pointer): resolve an RFC 6901 JSON Pointer against doc.
// - ""        → the whole document
// - "/a/b/0"  → doc.a.b[0]
// - "~1" in a token decodes to "/" and "~0" decodes to "~"
// - any missing path → undefined (never throw)
// TODO: not implemented yet.
export function getByPointer(_doc: unknown, _pointer: string): unknown {
  return undefined;
}
