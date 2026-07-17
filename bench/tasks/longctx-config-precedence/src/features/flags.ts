import { getConfig } from "../config";

export function isEnabled(flag: string): boolean {
  return getConfig().featureFlags[flag] === true;
}
