import { emit } from "../metrics/registry";

export function shipParcel(weightKg: number): string {
  emit("shipping.dispatched", 1);
  emit("shipping.weight_kg", weightKg);
  return `parcel-${weightKg}`;
}
