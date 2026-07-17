/** Currency helpers — amounts move through the system in minor units (cents). */
export function toMinorUnits(amount: number): number {
  // BUG: floating-point artifacts make e.g. 19.99 * 100 = 1998.9999999999998,
  // and truncation turns it into 1998.
  return Math.floor(amount * 100);
}

export function fromMinorUnits(cents: number): number {
  return cents / 100;
}

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
