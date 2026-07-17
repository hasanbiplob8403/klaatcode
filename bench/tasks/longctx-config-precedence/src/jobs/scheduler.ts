import { getConfig } from "../config";

export function workerCount(): number {
  // One worker per DB connection, capped at 8.
  return Math.min(getConfig().dbPoolSize, 8);
}
