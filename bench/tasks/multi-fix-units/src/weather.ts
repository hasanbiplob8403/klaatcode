import { celsiusToFahrenheit } from "./units.js";

// weatherReport(city, celsius): human-readable report with both units.
export function weatherReport(city: string, celsius: number): string {
  const f = celsiusToFahrenheit(celsius);
  return `${city}: ${celsius}°C (${Math.round(f)}°F)`;
}
