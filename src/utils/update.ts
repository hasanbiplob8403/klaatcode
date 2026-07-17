/**
 * Update check — polls https://klaatai.com/api/latest (which tracks the
 * latest GitHub release, i.e. the version every install channel serves) and
 * compares against the running version.
 *
 * Fail-silent by design: no network, bad JSON, or slow endpoint must never
 * affect the CLI. Result cached in ~/.klaatai/update-check.json so we hit
 * the endpoint at most once per CHECK_INTERVAL.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { version as VERSION } from "../../package.json";

const LATEST_URL = "https://klaatai.com/api/latest";
const CACHE_FILE = join(homedir(), ".klaatai", "update-check.json");
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4h
const FETCH_TIMEOUT_MS = 3_000;

export interface UpdateInfo {
  current: string;
  latest: string;
  updateAvailable: boolean;
}

interface CacheShape {
  checkedAt: number;
  latest: string;
}

/** -1 if a<b, 0 if equal, 1 if a>b. Prerelease tags compared lexically after the triple. */
export function compareSemver(a: string, b: string): number {
  const parse = (v: string): { nums: number[]; pre: string } => {
    const m = /^(\d+)\.(\d+)\.(\d+)(?:-([\w.]+))?/.exec(v.trim().replace(/^v/, ""));
    if (!m) return { nums: [0, 0, 0], pre: "" };
    return { nums: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] ?? "" };
  };
  const pa = parse(a), pb = parse(b);
  for (let i = 0; i < 3; i++) {
    if (pa.nums[i]! !== pb.nums[i]!) return pa.nums[i]! < pb.nums[i]! ? -1 : 1;
  }
  // No prerelease > prerelease (1.0.0 > 1.0.0-beta)
  if (pa.pre === pb.pre) return 0;
  if (!pa.pre) return 1;
  if (!pb.pre) return -1;
  return pa.pre < pb.pre ? -1 : 1;
}

function readCache(): CacheShape | null {
  try {
    const c = JSON.parse(readFileSync(CACHE_FILE, "utf-8")) as CacheShape;
    if (typeof c.checkedAt === "number" && typeof c.latest === "string") return c;
  } catch { /* no cache */ }
  return null;
}

function writeCache(latest: string): void {
  try {
    mkdirSync(join(homedir(), ".klaatai"), { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify({ checkedAt: Date.now(), latest } satisfies CacheShape));
  } catch { /* fail-silent */ }
}

async function fetchLatest(): Promise<string | null> {
  try {
    const res = await fetch(LATEST_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "User-Agent": `klaatcode/${VERSION}` },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { version?: string };
    return typeof body.version === "string" && body.version ? body.version : null;
  } catch {
    return null;
  }
}

/**
 * Check for a newer release. Cached (4h) unless `force`.
 * Returns null when the check could not be performed (offline etc.).
 */
export async function checkForUpdate(force = false): Promise<UpdateInfo | null> {
  let latest: string | null = null;

  if (!force) {
    const cache = readCache();
    if (cache && Date.now() - cache.checkedAt < CHECK_INTERVAL_MS) latest = cache.latest;
  }
  if (!latest) {
    latest = await fetchLatest();
    if (latest) writeCache(latest);
  }
  if (!latest) return null;

  return {
    current: VERSION,
    latest,
    updateAvailable: compareSemver(VERSION, latest) < 0,
  };
}
