// Evaluate a minimal arithmetic formula that can call `score(n)` and reference
// named context variables. Supports +, -, *, /, parentheses, integer and
// decimal literals. `score(n)` reads the value of the DOM element with id
// `score${n}` — a `<select>` inside a scoring cell — and falls back to 0 when
// the element is missing or its value is not numeric.
//
// Ported 1:1 from PostCanvas.evaluateFormula in the pre-migration canvas.js.

export function evaluateFormula(formula: string, context: Record<string, number>): number {
  const tokens = formula.match(/(\d+(\.\d+)?)|([a-zA-Z_]\w*)|([+\-*/()])/g);
  if (!tokens) return 0;

  let pos = 0;
  const peek = (): string | undefined => tokens[pos];
  const consume = (): string => tokens[pos++]!;

  // expr = term (('+' | '-') term)*
  function parseExpr(): number {
    let result = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      result = op === '+' ? result + right : result - right;
    }
    return result;
  }

  function parseTerm(): number {
    let result = parseFactor();
    while (peek() === '*' || peek() === '/') {
      const op = consume();
      const right = parseFactor();
      result = op === '*' ? result * right : result / right;
    }
    return result;
  }

  function parseFactor(): number {
    const token = peek();
    if (token === '(') {
      consume(); // '('
      const result = parseExpr();
      consume(); // ')'
      return result;
    }
    if (/^\d/.test(token!)) {
      return parseFloat(consume());
    }
    // identifier: function call `score(n)` or context variable lookup
    const name = consume();
    if (peek() === '(') {
      consume(); // '('
      const arg = parseExpr();
      consume(); // ')'
      if (name === 'score') {
        const el = document.getElementById(`score${arg}`) as HTMLSelectElement | null;
        return parseFloat(el?.value ?? '') || 0;
      }
      return 0;
    }
    return context[name] ?? 0;
  }

  return parseExpr();
}
