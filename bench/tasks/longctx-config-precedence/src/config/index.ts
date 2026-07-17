import { resolveConfig } from "./resolve";
import type { AppConfig } from "./types";

let cached: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!cached) cached = resolveConfig();
  return cached;
}

export function reloadConfig(): AppConfig {
  cached = resolveConfig();
  return cached;
}
