/** Currency helpers — amounts move through the system in minor units (cents). */
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

export function fromMinorUnits(cents: number): number {
  return cents / 100;
}

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
