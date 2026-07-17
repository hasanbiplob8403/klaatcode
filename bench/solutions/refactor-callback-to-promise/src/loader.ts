export function loadUsers(source: () => string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    try {
      const parsed = JSON.parse(source()) as { name: string }[];
      resolve(parsed.map((u) => u.name));
    } catch (e) {
      reject(e as Error);
    }
  });
}
