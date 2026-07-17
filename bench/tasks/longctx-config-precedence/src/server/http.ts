import { getConfig } from "../config";

export function listenAddress(): string {
  const cfg = getConfig();
  return `${cfg.host}:${cfg.port}`;
}
