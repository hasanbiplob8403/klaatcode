import { DEFAULTS } from "./defaults";
import { loadFileConfig } from "./file";
import { loadEnvConfig } from "./env";
import type { AppConfig } from "./types";

/**
 * Resolution order (weakest to strongest): defaults < file < environment.
 */
export function resolveConfig(): AppConfig {
  const file = loadFileConfig();
  const env = loadEnvConfig();
  return { ...DEFAULTS, ...file, ...env };
}
