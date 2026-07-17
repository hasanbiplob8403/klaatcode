export function highlight(text: string, term: string): string {
  return text.split(term).join(`[${term}]`);
}
