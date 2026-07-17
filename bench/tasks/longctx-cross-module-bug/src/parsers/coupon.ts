export interface Coupon { code: string; percentOff: number }
const COUPONS: Record<string, number> = { SAVE10: 10, SAVE20: 20 };
export function parseCoupon(code: string | undefined): Coupon | null {
  if (!code) return null;
  const pct = COUPONS[code.toUpperCase()];
  return pct === undefined ? null : { code: code.toUpperCase(), percentOff: pct };
}
