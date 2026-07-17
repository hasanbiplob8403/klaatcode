import { cacheGet, cacheSet } from "../cache/store";
import { cacheKey } from "../cache/keys";

export interface Session { token: string; userId: string; createdAt: number }

export function createSession(userId: string): Session {
  const session: Session = {
    token: `tok_${userId}_${Math.random().toString(36).slice(2)}`,
    userId,
    createdAt: Date.now(),
  };
  cacheSet(cacheKey("session", session.token), session, 30 * 60_000);
  return session;
}

export function getSession(token: string): Session | undefined {
  return cacheGet<Session>(cacheKey("session", token));
}
