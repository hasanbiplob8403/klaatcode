import { emit } from "../metrics/registry";

export function deliverWebhook(url: string): boolean {
  emit("webhooks.delivered", 1, { host: new URL(url).host });
  return true;
}
