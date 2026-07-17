export function evaluate(expr: string): number {
  let pos = 0;

  const peek = (): string | undefined => {
    while (pos < expr.length && expr[pos] === " ") pos++;
    return expr[pos];
  };

  function parseExpr(): number {
    let v = parseTerm();
    for (;;) {
      const c = peek();
      if (c === "+") { pos++; v += parseTerm(); }
      else if (c === "-") { pos++; v -= parseTerm(); }
      else break;
    }
    return v;
  }

  function parseTerm(): number {
    let v = parseFactor();
    for (;;) {
      const c = peek();
      if (c === "*") { pos++; v *= parseFactor(); }
      else if (c === "/") { pos++; v /= parseFactor(); }
      else break;
    }
    return v;
  }

  function parseFactor(): number {
    const c = peek();
    if (c === "(") {
      pos++;
      const v = parseExpr();
      if (peek() !== ")") throw new Error(`Expected ')' at position ${pos}`);
      pos++;
      return v;
    }
    const start = pos;
    while (pos < expr.length && /[0-9.]/.test(expr[pos]!)) pos++;
    if (pos === start) throw new Error(`Unexpected character at position ${pos}`);
    const n = Number(expr.slice(start, pos));
    if (Number.isNaN(n)) throw new Error(`Invalid number at position ${start}`);
    return n;
  }

  const v = parseExpr();
  if (peek() !== undefined) throw new Error(`Unexpected trailing input at position ${pos}`);
  return v;
}
