// Minimal event emitter.
// - on(event, fn): subscribe; returns an unsubscribe function.
// - once(event, fn): like on, but the listener fires at most once.
// - emit(event, ...args): call listeners in subscription order with args;
//   returns the number of listeners called. Unknown event → 0.
// TODO: not implemented yet.
type Listener = (...args: unknown[]) => void;

export class Emitter {
  on(_event: string, _fn: Listener): () => void { return () => {}; }
  once(_event: string, _fn: Listener): void {}
  emit(_event: string, ..._args: unknown[]): number { return 0; }
}
