import { emit } from "../metrics/registry";

export function recordLogin(userId: string): string {
  emit("logins.count", 1);
  return userId;
}
