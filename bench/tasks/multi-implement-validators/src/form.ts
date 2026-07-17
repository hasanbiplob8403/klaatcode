import { isNonEmpty, isValidAge, isValidEmail } from "./validators.js";

export interface FormData {
  name: string;
  email: string;
  age: number;
}

// validateForm(data): returns a list of error messages, empty when valid.
// This file is CORRECT — the validators it uses are not implemented.
export function validateForm(data: FormData): string[] {
  const errors: string[] = [];
  if (!isNonEmpty(data.name)) errors.push("name: required");
  if (!isValidEmail(data.email)) errors.push("email: invalid");
  if (!isValidAge(data.age)) errors.push("age: must be an integer 0-150");
  return errors;
}
