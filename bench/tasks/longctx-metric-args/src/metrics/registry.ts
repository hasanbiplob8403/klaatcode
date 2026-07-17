export interface MetricEntry { name: string; value: number; tags?: Record<string, string> }

const entries: MetricEntry[] = [];

/** Record one metric sample. Name first, numeric value second. */
export function emit(name: string, value: number, tags?: Record<string, string>): void {
  entries.push({ name, value, tags });
}

export function snapshot(): MetricEntry[] { return [...entries]; }
export function totalFor(name: string): number {
  return entries.filter(e => e.name === name).reduce((s, e) => s + e.value, 0);
}
export function resetMetrics(): void { entries.length = 0; }
