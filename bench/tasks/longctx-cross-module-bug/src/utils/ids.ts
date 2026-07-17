let counter = 0;
export function nextId(prefix: string): string {
  return `${prefix}-${++counter}`;
}
export function resetIds(): void { counter = 0; }
