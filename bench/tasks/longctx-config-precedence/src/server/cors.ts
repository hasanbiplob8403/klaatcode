import { getConfig } from "../config";

export function isAllowedOrigin(origin: string): boolean {
  return getConfig().corsOrigins.includes(origin);
}
