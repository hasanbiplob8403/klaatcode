export function getByPointer(doc: unknown, pointer: string): unknown {
  if (pointer === "") return doc;
  let cur: unknown = doc;
  for (const raw of pointer.split("/").slice(1)) {
    const token = raw.replace(/~1/g, "/").replace(/~0/g, "~");
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[token];
    if (cur === undefined) return undefined;
  }
  return cur;
}
