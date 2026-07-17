import { test, expect, beforeEach } from "bun:test";
import { setEnv } from "./config/env";
import { setFileConfig } from "./config/file";
import { reloadConfig } from "./config";
import { listenAddress } from "./server/http";
import { createPool } from "./db/pool";
import { shouldLog } from "./log/logger";
import { requestDeadline } from "./server/timeouts";

beforeEach(() => {
  setEnv({});
  setFileConfig({});
  reloadConfig();
});

test("defaults apply when nothing overrides them", () => {
  expect(listenAddress()).toBe("127.0.0.1:3000");
  expect(createPool().size).toBe(5);
});

test("file config overrides defaults", () => {
  setFileConfig({ port: 8080, dbPoolSize: 10 });
  reloadConfig();
  expect(listenAddress()).toBe("127.0.0.1:8080");
  expect(createPool().size).toBe(10);
});

test("environment overrides file config and defaults", () => {
  setFileConfig({ port: 8080, logLevel: "warn" });
  setEnv({ APP_PORT: "9999", APP_LOG_LEVEL: "error", APP_TIMEOUT_MS: "5000" });
  reloadConfig();
  expect(listenAddress()).toBe("127.0.0.1:9999");
  expect(shouldLog("warn")).toBe(false); // env raised the level to error
  expect(requestDeadline(0)).toBe(5000);
});

test("env-only override beats defaults", () => {
  setEnv({ APP_DB_POOL: "12" });
  reloadConfig();
  expect(createPool().size).toBe(12);
});
