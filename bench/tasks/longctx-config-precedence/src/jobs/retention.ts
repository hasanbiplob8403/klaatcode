import { shouldLog } from "../log/logger";

export function purgeOldRecords(days: number): string {
  if (shouldLog("debug")) return `purge:${days}:verbose`;
  return `purge:${days}`;
}
