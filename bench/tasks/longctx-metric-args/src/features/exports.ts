import { emit } from "../metrics/registry";

export function exportReport(rows: number): string {
  emit("exports.generated", 1);
  emit("exports.rows", rows);
  return `report:${rows}`;
}
