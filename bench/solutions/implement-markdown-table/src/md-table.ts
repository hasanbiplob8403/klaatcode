export function markdownTable(header: string[], rows: string[][]): string {
  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)),
  );
  const line = (cells: string[]) =>
    "| " + widths.map((w, i) => (cells[i] ?? "").padEnd(w)).join(" | ") + " |";
  const sep = "| " + widths.map((w) => "-".repeat(w)).join(" | ") + " |";
  return [line(header), sep, ...rows.map(line)].join("\n");
}
