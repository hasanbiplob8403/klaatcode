// loadUsers(source, callback): legacy callback API.
// REFACTOR GOAL: convert this to a Promise API —
//   loadUsers(source: () => string): Promise<string[]>
// resolving with the parsed user names, rejecting with an Error on
// invalid JSON. The tests already use the Promise form.
export function loadUsers(
  source: () => string,
  callback: (err: Error | null, names?: string[]) => void,
): void {
  try {
    const parsed = JSON.parse(source()) as { name: string }[];
    callback(null, parsed.map((u) => u.name));
  } catch (e) {
    callback(e as Error);
  }
}
