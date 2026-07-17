export function isNonEmpty(s: string): boolean {
  return s.trim().length > 0;
}

export function isValidEmail(s: string): boolean {
  const parts = s.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  return local!.length > 0 && domain!.includes(".") && domain!.length > 2;
}

export function isValidAge(n: number): boolean {
  return Number.isInteger(n) && n >= 0 && n <= 150;
}
