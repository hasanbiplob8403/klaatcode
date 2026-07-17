export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}
