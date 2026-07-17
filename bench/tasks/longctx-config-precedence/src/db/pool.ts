import { getConfig } from "../config";

export interface Pool { size: number; active: number }

export function createPool(): Pool {
  return { size: getConfig().dbPoolSize, active: 0 };
}
