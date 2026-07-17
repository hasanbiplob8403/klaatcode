// reverseWords(s): reverse the order of words in a sentence.
// Words are separated by single spaces. This implementation has a bug.
export function reverseWords(s: string): string {
  return s.split("").reverse().join(" ");
}
