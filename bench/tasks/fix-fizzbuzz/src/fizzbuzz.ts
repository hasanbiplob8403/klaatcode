// fizzbuzz(n): "Fizz" if divisible by 3, "Buzz" if by 5, "FizzBuzz" if both,
// otherwise the number as a string. This implementation has a bug.
export function fizzbuzz(n: number): string {
  if (n % 3 === 0) return "Fizz";
  if (n % 5 === 0) return "Buzz";
  return String(n);
}
