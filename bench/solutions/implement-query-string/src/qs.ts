export function parseQuery(qs: string): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  if (!qs) return out;
  for (const part of qs.split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    const rawK = eq === -1 ? part : part.slice(0, eq);
    const rawV = eq === -1 ? "" : part.slice(eq + 1);
    const k = decodeURIComponent(rawK.replace(/\+/g, " "));
    const v = decodeURIComponent(rawV.replace(/\+/g, " "));
    const existing = out[k];
    if (existing === undefined) out[k] = v;
    else if (Array.isArray(existing)) existing.push(v);
    else out[k] = [existing, v];
  }
  return out;
}
