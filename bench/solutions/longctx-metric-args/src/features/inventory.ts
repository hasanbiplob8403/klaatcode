import { emit } from "../metrics/registry";

export function adjustStock(delta: number): number {
  emit("inventory.adjusted", delta);
  return delta;
}
