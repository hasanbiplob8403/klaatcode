import { getConfig } from "../config";

export function requestDeadline(startedAt: number): number {
  return startedAt + getConfig().requestTimeoutMs;
}
