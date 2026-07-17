import { parseAddress, type Address } from "../parsers/address.js";
export interface Customer { email: string; address: Address }
export function makeCustomer(email: string, rawAddress: string): Customer {
  if (!/^[^@]+@[^@]+$/.test(email)) throw new Error("bad email");
  return { email, address: parseAddress(rawAddress) };
}
