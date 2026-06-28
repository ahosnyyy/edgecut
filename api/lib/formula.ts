// Shared arithmetic formula evaluator for the API side.
// Supports + - * / and parentheses over numeric literals and named variables.

const OPS: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };

function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (ch === " " || ch === "\t" || ch === "\n") { i++; continue; }
    if (ch === "(" || ch === ")") { tokens.push(ch); i++; continue; }
    if ("+-*/".includes(ch)) { tokens.push(ch); i++; continue; }
    if (/[0-9.]/.test(ch)) {
      let num = "";
      while (i < expr.length && /[0-9.]/.test(expr[i])) { num += expr[i]; i++; }
      tokens.push(num);
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let ident = "";
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) { ident += expr[i]; i++; }
      tokens.push(ident);
      continue;
    }
    throw new Error(`Unexpected character: "${ch}"`);
  }
  return tokens;
}

function toRPN(tokens: string[]): string[] {
  const output: string[] = [];
  const stack: string[] = [];
  for (const token of tokens) {
    if (token === "(") {
      stack.push(token);
    } else if (token === ")") {
      while (stack.length && stack[stack.length - 1] !== "(") output.push(stack.pop()!);
      stack.pop();
    } else if (token in OPS) {
      while (stack.length && stack[stack.length - 1] in OPS && OPS[stack[stack.length - 1]] >= OPS[token]) {
        output.push(stack.pop()!);
      }
      stack.push(token);
    } else {
      output.push(token);
    }
  }
  while (stack.length) output.push(stack.pop()!);
  return output;
}

function evalRPN(rpn: string[], ctx: Record<string, number>): number {
  const stack: number[] = [];
  for (const token of rpn) {
    if (token in OPS) {
      const b = stack.pop()!;
      const a = stack.pop()!;
      switch (token) {
        case "+": stack.push(a + b); break;
        case "-": stack.push(a - b); break;
        case "*": stack.push(a * b); break;
        case "/": if (b === 0) throw new Error("Division by zero"); stack.push(a / b); break;
      }
    } else if (/^[0-9.]+$/.test(token)) {
      stack.push(parseFloat(token));
    } else {
      if (!(token in ctx)) throw new Error(`Unknown variable: ${token}`);
      stack.push(ctx[token]);
    }
  }
  const result = stack[0];
  return Math.round(result * 100) / 100;
}

export function evalFormula(formula: string, ctx: Record<string, number>): number {
  const tokens = tokenize(formula);
  const rpn = toRPN(tokens);
  return evalRPN(rpn, ctx);
}
