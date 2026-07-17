type Listener = (...args: unknown[]) => void;

export class Emitter {
  private listeners = new Map<string, Listener[]>();
  on(event: string, fn: Listener): () => void {
    const list = this.listeners.get(event) ?? [];
    list.push(fn);
    this.listeners.set(event, list);
    return () => {
      const cur = this.listeners.get(event) ?? [];
      const i = cur.indexOf(fn);
      if (i >= 0) cur.splice(i, 1);
    };
  }
  once(event: string, fn: Listener): void {
    const off = this.on(event, (...args) => {
      off();
      fn(...args);
    });
  }
  emit(event: string, ...args: unknown[]): number {
    const list = [...(this.listeners.get(event) ?? [])];
    for (const fn of list) fn(...args);
    return list.length;
  }
}
