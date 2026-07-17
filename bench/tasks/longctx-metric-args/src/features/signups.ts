import { emit } from "../metrics/registry";

export function registerUser(email: string): { email: string } {
  emit("users.signup", 1, { source: "web" });
  return { email };
}
