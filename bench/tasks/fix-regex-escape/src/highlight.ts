// highlight(text, term): wrap every occurrence of term in [brackets].
// term is a LITERAL string, not a regex. This implementation breaks when
// term contains regex metacharacters.
export function highlight(text: string, term: string): string {
  return text.replace(new RegExp(term, "g"), `[${term}]`);
}
