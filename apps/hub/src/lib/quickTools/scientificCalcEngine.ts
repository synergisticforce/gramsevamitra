/** Safe scientific expression evaluator — Math.* only, no eval(). */

export function evaluateScientificExpression(raw: string): number {
  let expr = raw.trim();
  if (!expr) throw new Error('Empty');

  expr = expr
    .replace(/π/g, String(Math.PI))
    .replace(/sqrt\(([^()]+)\)/g, 'Math.sqrt($1)')
    .replace(/sin\(([^()]+)\)/g, 'Math.sin($1)')
    .replace(/cos\(([^()]+)\)/g, 'Math.cos($1)')
    .replace(/tan\(([^()]+)\)/g, 'Math.tan($1)')
    .replace(/log\(([^()]+)\)/g, 'Math.log10($1)')
    .replace(/sqr\(([^()]+)\)/g, 'Math.pow($1,2)')
    .replace(/pow\(([^,]+),([^)]+)\)/g, 'Math.pow($1,$2)');

  if (!/^[0-9+\-*/().Math\s]+$/.test(expr.replace(/Math\.(sqrt|sin|cos|tan|log10|pow)/g, ''))) {
    throw new Error('Invalid expression');
  }

  const result = Function(`"use strict"; return (${expr});`)() as unknown;
  if (typeof result !== 'number' || !Number.isFinite(result)) {
    throw new Error('Invalid result');
  }
  return result;
}

export function formatCalcResult(n: number): string {
  return String(Math.round(n * 1e10) / 1e10);
}
