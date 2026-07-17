export function assertPositive(n: number, name: string): void {
  if (!(n > 0)) throw new Error(`${name} must be positive, got ${n}`);
}
export function assertNonEmpty(s: string, name: string): void {
  if (!s.trim()) throw new Error(`${name} must not be empty`);
}
