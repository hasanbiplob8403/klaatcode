export async function fetchAll(
  ids: number[],
  fetchOne: (id: number) => Promise<string>,
): Promise<string[]> {
  return Promise.all(ids.map((id) => fetchOne(id)));
}
