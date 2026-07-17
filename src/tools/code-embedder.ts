/**
 * Server-side embedding via /v1/rag/embed (baai/bge-m3, 1024-dim).
 * Stateless — caller supplies token + serverUrl each time.
 */

const BATCH_SIZE = 150;
export const EMBEDDING_DIM = 1024;

async function callEmbedEndpoint(texts: string[], token: string, serverUrl: string): Promise<Float32Array[]> {
  const resp = await fetch(`${serverUrl}/v1/rag/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ filename: "_code_index", chunks: texts }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`Embed HTTP ${resp.status}: ${detail.slice(0, 200)}`);
  }
  const data = await resp.json() as { embeddings: number[][] };
  return data.embeddings.map((v) => new Float32Array(v));
}

export async function embedPassages(texts: string[], token: string, serverUrl: string): Promise<Float32Array[]> {
  if (texts.length === 0) return [];
  const results: Float32Array[] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const vecs = await callEmbedEndpoint(texts.slice(i, i + BATCH_SIZE), token, serverUrl);
    results.push(...vecs);
  }
  return results;
}

export async function embedQuery(text: string, token: string, serverUrl: string): Promise<Float32Array> {
  const [vec] = await callEmbedEndpoint([text], token, serverUrl);
  return vec;
}
