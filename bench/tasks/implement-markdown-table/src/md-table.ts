// markdownTable(header, rows): render a GitHub-style markdown table.
// - every column padded with spaces to its widest cell (header included)
// - a separator row of dashes exactly matching each column width
// - cells joined with " | "; every line starts with "| " and ends with " |"
// - lines joined with "\n" (no trailing newline)
// Example:
//   markdownTable(["name", "n"], [["ada", "1"]]) →
//   | name | n |
//   | ---- | - |
//   | ada  | 1 |
// TODO: not implemented yet.
export function markdownTable(_header: string[], _rows: string[][]): string {
  return "";
}
