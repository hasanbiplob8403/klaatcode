export interface Address { line1: string; city: string; zip: string }
export function parseAddress(raw: string): Address {
  const [line1, city, zip] = raw.split("|").map(s => s.trim());
  if (!line1 || !city || !zip) throw new Error("address needs line1|city|zip");
  return { line1, city, zip };
}
