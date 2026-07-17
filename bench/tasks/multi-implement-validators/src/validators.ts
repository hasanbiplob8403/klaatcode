// Validation primitives used by form.ts.
// - isNonEmpty(s): true when s contains at least one non-whitespace char.
// - isValidEmail(s): true for simple emails: exactly one "@", non-empty
//   local part, domain containing at least one ".".
// - isValidAge(n): true for integers 0..150.
// TODO: not implemented yet — every validator currently rejects everything.
export function isNonEmpty(_s: string): boolean { return false; }
export function isValidEmail(_s: string): boolean { return false; }
export function isValidAge(_n: number): boolean { return false; }
