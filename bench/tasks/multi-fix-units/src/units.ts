// Temperature conversions.
export function celsiusToFahrenheit(c: number): number {
  return c * (5 / 9) + 32;
}

export function fahrenheitToCelsius(f: number): number {
  return (f - 32) * (5 / 9);
}
