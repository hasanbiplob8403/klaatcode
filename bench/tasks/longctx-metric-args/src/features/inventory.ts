import { emit } from "../metrics/registry";

export function adjustStock(delta: number): number {
  // @ts-expect-error legacy call style
  emit(delta, "inventory.adjusted");
  return delta;
}
