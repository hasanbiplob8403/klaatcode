/**
 * OAuth 2.1 for remote MCP servers (MCP auth spec, 2025-03-26 revision).
 *
 * Flow, first connect to a protected server:
 *   1. Server answers a request with 401 → we discover its authorization
 *      server metadata (RFC 8414: /.well-known/oauth-authorization-server,
 *      with the MCP fallback of the server origin itself).
 *   2. Dynamic client registration (RFC 7591) when a registration_endpoint
 *      exists — no pre-provisioned client ids needed.
 *   3. Authorization-code + PKCE (S256) through the user's browser with a
 *      localhost callback, same UX as `klaatai login`.
 *   4. Tokens persisted per server origin in ~/.klaatai/mcp-oauth.json;
 *      refreshed via refresh_token when expired, silent when possible.
 *
 * Everything here is fail-soft: any error returns null and the MCP client
 * reports the server as auth-required rather than crashing the REPL.
 */

import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { openBrowser } from "../auth/browser.js";

const STORE_FILE = join(homedir(), ".klaatai", "mcp-oauth.json");
const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;

interface AuthServerMeta {
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  code_challenge_methods_supported?: string[];
}

interface StoredToken {
  accessToken: string;
  refreshToken?: string;
  /** Unix seconds. 0 = unknown/never expires. */
  expiresAt: number;
  clientId: string;
  clientSecret?: string;
  tokenEndpoint: string;
}

type TokenStore = Record<string, StoredToken>; // keyed by MCP server origin

function loadStore(): TokenStore {
  try { return JSON.parse(readFileSync(STORE_FILE, "utf-8")) as TokenStore; }
  catch { return {}; }
}

function saveStore(store: TokenStore): void {
  try {
    mkdirSync(join(homedir(), ".klaatai"), { recursive: true });
    writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), { mode: 0o600 });
  } catch { /* fail-soft */ }
}

/** Best-effort JSON fetch with a short timeout; null on any failure. */
async function getJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch { return null; }
}

async function discoverAuthServer(mcpUrl: string): Promise<AuthServerMeta | null> {
  const origin = new URL(mcpUrl).origin;
  // RFC 8414 well-known, then MCP's fallback: default endpoints on the origin.
  const meta = await getJson<AuthServerMeta>(`${origin}/.well-known/oauth-authorization-server`);
  if (meta?.authorization_endpoint && meta.token_endpoint) return meta;
  return {
    authorization_endpoint: `${origin}/authorize`,
    token_endpoint: `${origin}/token`,
    registration_endpoint: `${origin}/register`,
  };
}

async function registerClient(meta: AuthServerMeta, redirectUri: string): Promise<{ clientId: string; clientSecret?: string } | null> {
  if (!meta.registration_endpoint) return null;
  const reg = await getJson<{ client_id?: string; client_secret?: string }>(meta.registration_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "KlaatAI CLI",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none", // public client + PKCE
    }),
  });
  return reg?.client_id ? { clientId: reg.client_id, clientSecret: reg.client_secret } : null;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

async function exchangeToken(
  tokenEndpoint: string, params: Record<string, string>,
): Promise<TokenResponse | null> {
  return getJson<TokenResponse>(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
}

/** Cached token for a server if present and not expired (60s slack). */
export function storedMcpToken(mcpUrl: string): string | null {
  const origin = new URL(mcpUrl).origin;
  const tok = loadStore()[origin];
  if (!tok) return null;
  if (tok.expiresAt && tok.expiresAt - 60 < Date.now() / 1000) return null;
  return tok.accessToken;
}

/** Refresh an expired token without user interaction. Null if impossible. */
export async function refreshMcpToken(mcpUrl: string): Promise<string | null> {
  const origin = new URL(mcpUrl).origin;
  const store = loadStore();
  const tok = store[origin];
  if (!tok?.refreshToken) return null;
  const r = await exchangeToken(tok.tokenEndpoint, {
    grant_type: "refresh_token",
    refresh_token: tok.refreshToken,
    client_id: tok.clientId,
    ...(tok.clientSecret ? { client_secret: tok.clientSecret } : {}),
  });
  if (!r?.access_token) return null;
  store[origin] = {
    ...tok,
    accessToken: r.access_token,
    refreshToken: r.refresh_token ?? tok.refreshToken,
    expiresAt: r.expires_in ? Math.floor(Date.now() / 1000) + r.expires_in : 0,
  };
  saveStore(store);
  return r.access_token;
}

/**
 * Full interactive flow: discovery → registration → browser consent → token.
 * `onStatus` narrates progress into the REPL. Null on failure/timeout.
 */
export async function authorizeMcpServer(
  mcpUrl: string,
  onStatus: (msg: string) => void,
): Promise<string | null> {
  const origin = new URL(mcpUrl).origin;
  const meta = await discoverAuthServer(mcpUrl);
  if (!meta) { onStatus(`No OAuth metadata found for ${origin}.`); return null; }

  // Reuse a previously registered client for this origin when we have one.
  const store = loadStore();
  let clientId = store[origin]?.clientId;
  let clientSecret = store[origin]?.clientSecret;

  if (!clientId) {
    // RFC 8252 §7.3: loopback redirects must be accepted with any port, so a
    // portless loopback URI is fine at registration time.
    const reg = await registerClient(meta, "http://127.0.0.1/callback");
    if (!reg?.clientId) {
      onStatus(`Server at ${origin} requires OAuth but offers no client registration. Configure "headers" with a token in .klaatai/mcp.json instead.`);
      return null;
    }
    clientId = reg.clientId;
    clientSecret = reg.clientSecret;
  }

  onStatus(`Opening browser to authorize ${origin} …`);
  return authorizeWithKnownPort(origin, meta, clientId, clientSecret, onStatus);
}

/** The actual working flow: listener first, then browser, then exchange. */
async function authorizeWithKnownPort(
  mcpOrigin: string,
  meta: AuthServerMeta,
  clientId: string,
  clientSecret: string | undefined,
  onStatus: (msg: string) => void,
): Promise<string | null> {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(16).toString("hex");

  return new Promise((resolve) => {
    let settled = false;
    const settle = (v: string | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      server.close();
      resolve(v);
    };
    const server = createServer((req, res) => {
      void (async () => {
        const url = new URL(req.url ?? "/", "http://localhost");
        if (url.pathname !== "/callback") { res.writeHead(404); res.end(); return; }
        const code = url.searchParams.get("code");
        const ok = url.searchParams.get("state") === state && !!code;
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(ok
          ? "<html><body style='font-family:sans-serif;text-align:center;padding-top:20vh'><h2>MCP server connected</h2><p>Return to your terminal.</p></body></html>"
          : "<html><body style='font-family:sans-serif;text-align:center;padding-top:20vh'><h2>Authorization failed</h2><p>Return to your terminal and try again.</p></body></html>");
        if (!ok) { settle(null); return; }
        const addr = server.address();
        const port = addr && typeof addr !== "string" ? addr.port : 0;
        const r = await exchangeToken(meta.token_endpoint, {
          grant_type: "authorization_code",
          code: code!,
          redirect_uri: `http://127.0.0.1:${port}/callback`,
          client_id: clientId,
          code_verifier: verifier,
          ...(clientSecret ? { client_secret: clientSecret } : {}),
        });
        if (!r?.access_token) { onStatus("Token exchange failed."); settle(null); return; }
        const store = loadStore();
        store[mcpOrigin] = {
          accessToken: r.access_token,
          refreshToken: r.refresh_token,
          expiresAt: r.expires_in ? Math.floor(Date.now() / 1000) + r.expires_in : 0,
          clientId, clientSecret,
          tokenEndpoint: meta.token_endpoint,
        };
        saveStore(store);
        onStatus("MCP server authorized.");
        settle(r.access_token);
      })().catch(() => settle(null));
    });
    const timer = setTimeout(() => settle(null), CALLBACK_TIMEOUT_MS);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") { settle(null); return; }
      const authUrl = new URL(meta.authorization_endpoint);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", `http://127.0.0.1:${addr.port}/callback`);
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("code_challenge", challenge);
      authUrl.searchParams.set("code_challenge_method", "S256");
      openBrowser(authUrl.toString());
    });
  });
}
