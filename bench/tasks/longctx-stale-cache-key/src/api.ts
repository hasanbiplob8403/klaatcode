import { loadProfile } from "./services/profiles";
import { loadOrg } from "./services/orgs";
import { loadProduct } from "./services/products";
import { permissionsFor } from "./services/permissions";
import type { Profile } from "./models/user";

export async function getProfile(userId: string): Promise<Profile> {
  return loadProfile(userId);
}

export async function getOrgName(orgId: string): Promise<string> {
  return (await loadOrg(orgId)).name;
}

export async function getProductName(productId: string): Promise<string> {
  return (await loadProduct(productId)).name;
}

export async function canWrite(userId: string): Promise<boolean> {
  return (await permissionsFor(userId)).includes("write");
}
