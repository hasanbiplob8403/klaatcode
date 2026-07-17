import type { PartialConfig } from "./types";

/** Simulated process environment (injected in tests). */
let fakeEnv: Record<string, string> = {};

export function setEnv(env: Record<string, string>): void { fakeEnv = env; }

export function loadEnvConfig(): PartialConfig {
  const out: PartialConfig = {};
  if (fakeEnv.APP_PORT) out.port = Number(fakeEnv.APP_PORT);
  if (fakeEnv.APP_HOST) out.host = fakeEnv.APP_HOST;
  if (fakeEnv.APP_LOG_LEVEL) out.logLevel = fakeEnv.APP_LOG_LEVEL as PartialConfig["logLevel"];
  if (fakeEnv.APP_DB_POOL) out.dbPoolSize = Number(fakeEnv.APP_DB_POOL);
  if (fakeEnv.APP_TIMEOUT_MS) out.requestTimeoutMs = Number(fakeEnv.APP_TIMEOUT_MS);
  return out;
}
