import type { AppConfig } from "./types";

export const DEFAULTS: AppConfig = {
  port: 3000,
  host: "127.0.0.1",
  logLevel: "info",
  dbPoolSize: 5,
  corsOrigins: ["http://localhost:3000"],
  featureFlags: { newCheckout: false, betaSearch: false },
  requestTimeoutMs: 30_000,
};
