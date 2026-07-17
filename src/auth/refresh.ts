/**
 * Supabase token refresh — same flow KlaatAI.Code's token-manager uses.
 *
 * Access tokens live ~1h; the refresh token rotates on every use. Refresh goes
 * straight to Supabase Auth (GoTrue) with the public anon key — the KlaatAI
 * backend does not proxy refreshes.
 */

import { loadCredentials, saveCredentials, type Credentials } from "./credentials.js";

// Public anon key — safe to ship (Supabase anon keys are public by design;
// RLS enforces access). Same values as KlaatAI.Code / KlaatAI.VSCode.
const SUPABASE_URL = "https://smwmsqpxcpnrssdcizsp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_TPna9be9P76kH6KKXY_5JQ_fc-P3rLH";

/** Refresh within this window before expiry (seconds). */
const REFRESH_SKEW_S = 300;

let refreshInFlight: Promise<string | null> | null = null;

function tokenNeedsRefresh(creds: Credentials): boolean {
  if (!creds.accessToken || !creds.refreshToken) return false;
  if (!creds.expiresAt) return false;
  return Date.now() / 1000 >= creds.expiresAt - REFRESH_SKEW_S;
}

async function doRefresh(creds: Credentials): Promise<string | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: creds.refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!data.access_token) return null;
    saveCredentials({
      ...creds,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? creds.refreshToken,
      expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
    });
    return data.access_token;
  } catch {
    return null;
  }
}

/**
 * Returns a valid subscription JWT, refreshing the stored token when it is
 * expired or about to expire. Auth is browser-OAuth (JWT) only — stored kl-
 * API keys are ignored (weighted-unit quota + tier hints require a JWT session).
 * The `KLAATAI_API_KEY` env var is still honored as an explicit CI/headless
 * override. Single-flight: concurrent callers share one refresh (the refresh
 * token rotates per use — parallel refreshes would invalidate each other).
 */
/**
 * Returns a valid subscription JWT, refreshing the stored token when it is
 * expired or about to expire. Returns null if no credentials exist or if
 * the refresh token is dead (caller should trigger browser re-login).
 */
export async function getValidAuthToken(): Promise<string | null> {
  const env = process.env["KLAATAI_API_KEY"];
  if (env) return env;

  const creds = loadCredentials();
  if (!creds.accessToken) return null;

  if (tokenNeedsRefresh(creds)) {
    refreshInFlight ??= doRefresh(creds).finally(() => { refreshInFlight = null; });
    const refreshed = await refreshInFlight;
    if (refreshed) return refreshed;
    // Refresh token is dead — return null so caller can trigger re-login
    return null;
  }
  return creds.accessToken;
}

/**
 * Force-refresh the token regardless of expiry. Used by the 401 recovery path
 * to get a fresh token when the server rejects the current one.
 */
export async function forceRefreshToken(): Promise<string | null> {
  const env = process.env["KLAATAI_API_KEY"];
  if (env) return env;

  const creds = loadCredentials();
  if (!creds.refreshToken) return null;

  refreshInFlight ??= doRefresh(creds).finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}
