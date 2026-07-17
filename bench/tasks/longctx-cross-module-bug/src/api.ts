import { buildOrder, type Order } from "./services/orders.js";
import { makeCustomer, type Customer } from "./services/customers.js";
import { receiptText } from "./services/receipts.js";

export interface CheckoutResult { order: Order; customer: Customer; receipt: string }

export function checkout(email: string, rawAddress: string, lineInput: string, coupon?: string): CheckoutResult {
  const customer = makeCustomer(email, rawAddress);
  const order = buildOrder(lineInput, coupon);
  return { order, customer, receipt: receiptText(order) };
}
