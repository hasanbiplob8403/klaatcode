// fetchAll(ids, fetchOne): fetch every id concurrently and return the results
// in the same order as ids. This implementation has a bug.
export async function fetchAll(
  ids: number[],
  fetchOne: (id: number) => Promise<string>,
): Promise<string[]> {
  const results: string[] = [];
  ids.forEach(async (id) => {
    results.push(await fetchOne(id));
  });
  return results;
}
