import type { Org } from "../models/org";

const ORGS: Record<string, Org> = {
  o1: { id: "o1", name: "Initrode", plan: "pro" },
  o2: { id: "o2", name: "Globex", plan: "free" },
};

export async function fetchOrg(id: string): Promise<Org> {
  const o = ORGS[id];
  if (!o) throw new Error(`no such org: ${id}`);
  return { ...o };
}
