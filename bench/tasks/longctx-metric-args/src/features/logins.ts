import { emit } from "../metrics/registry";

export function recordLogin(userId: string): string {
  // @ts-expect-error legacy call style
  emit(1, "logins.count");
  return userId;
}
