export interface AppConfig {
  port: number;
  host: string;
  logLevel: "debug" | "info" | "warn" | "error";
  dbPoolSize: number;
  corsOrigins: string[];
  featureFlags: Record<string, boolean>;
  requestTimeoutMs: number;
}

export type PartialConfig = Partial<AppConfig>;
