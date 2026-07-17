import type { User } from "../models/user";

const USERS: Record<string, User> = {
  u1: { id: "u1", orgId: "o1", name: "Ada", email: "ada@example.com" },
  u2: { id: "u2", orgId: "o1", name: "Bram", email: "bram@example.com" },
  u3: { id: "u3", orgId: "o2", name: "Cleo", email: "cleo@example.com" },
};

let reads = 0;
export function dbUserReads(): number { return reads; }

export async function fetchUser(id: string): Promise<User> {
  reads++;
  const u = USERS[id];
  if (!u) throw new Error(`no such user: ${id}`);
  return { ...u };
}
