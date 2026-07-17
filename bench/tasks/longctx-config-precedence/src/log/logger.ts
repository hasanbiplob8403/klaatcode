import { getConfig } from "../config";

const LEVELS = ["debug", "info", "warn", "error"] as const;

export function shouldLog(level: (typeof LEVELS)[number]): boolean {
  return LEVELS.indexOf(level) >= LEVELS.indexOf(getConfig().logLevel);
}
