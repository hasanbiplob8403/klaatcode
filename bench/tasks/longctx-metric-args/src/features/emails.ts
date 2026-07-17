import { emit } from "../metrics/registry";

export function sendEmail(to: string, subject: string): boolean {
  emit("emails.sent", 1, { subject });
  return to.includes("@");
}
