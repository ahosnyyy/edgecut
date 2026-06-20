export interface FormulaContext {
  W: number;
  H: number;
  [key: string]: number;
}

export interface FormulaResult {
  value: number;
  error: string | null;
}

const ALLOWED_IDENTIFIERS = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const OPERATORS: Record<string, number> = {
  "+": 1,
  "-": 1,
  "*": 2,
  "/": 2,
};

function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (ch === " " || ch === "\t" || ch === "\n") {
      i++;
      continue;
    }
    if (ch === "(" || ch === ")") {
      tokens.push(ch);
      i++;
      continue;
    }
    if (ch in OPERATORS) {
      tokens.push(ch);
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let num = "";
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        num += expr[i];
        i++;
      }
      tokens.push(num);
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let ident = "";
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) {
        ident += expr[i];
        i++;
      }
      tokens.push(ident);
      continue;
    }
    throw new Error(`Unexpected character: "${ch}" at position ${i}`);
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
      while (stack.length > 0 && stack[stack.length - 1] !== "(") {
        output.push(stack.pop()!);
      }
      if (stack.length === 0) {
        throw new Error("Mismatched parentheses");
      }
      stack.pop();
    } else if (token in OPERATORS) {
      while (
        stack.length > 0 &&
        stack[stack.length - 1] in OPERATORS &&
        OPERATORS[stack[stack.length - 1]] >= OPERATORS[token]
      ) {
        output.push(stack.pop()!);
      }
      stack.push(token);
    } else {
      output.push(token);
    }
  }

  while (stack.length > 0) {
    const op = stack.pop()!;
    if (op === "(" || op === ")") {
      throw new Error("Mismatched parentheses");
    }
    output.push(op);
  }

  return output;
}

function evalRPN(rpn: string[], ctx: FormulaContext): number {
  const stack: number[] = [];

  for (const token of rpn) {
    if (token in OPERATORS) {
      if (stack.length < 2) {
        throw new Error(`Not enough operands for operator "${token}"`);
      }
      const b = stack.pop()!;
      const a = stack.pop()!;
      switch (token) {
        case "+":
          stack.push(a + b);
          break;
        case "-":
          stack.push(a - b);
          break;
        case "*":
          stack.push(a * b);
          break;
        case "/":
          if (b === 0) throw new Error("Division by zero");
          stack.push(a / b);
          break;
      }
    } else if (/^[0-9.]+$/.test(token)) {
      stack.push(parseFloat(token));
    } else {
      if (!ALLOWED_IDENTIFIERS.test(token)) {
        throw new Error(`Invalid identifier: "${token}"`);
      }
      if (!(token in ctx)) {
        throw new Error(`Unknown variable: "${token}"`);
      }
      const val = ctx[token];
      if (typeof val !== "number" || isNaN(val)) {
        throw new Error(`Variable "${token}" has invalid value`);
      }
      stack.push(val);
    }
  }

  if (stack.length !== 1) {
    throw new Error("Invalid expression");
  }

  return stack[0];
}

export function evaluateFormula(
  formula: string,
  ctx: FormulaContext,
): FormulaResult {
  try {
    const trimmed = formula.trim();
    if (!trimmed) {
      return { value: 0, error: "Empty formula" };
    }
    const tokens = tokenize(trimmed);
    const rpn = toRPN(tokens);
    const value = evalRPN(rpn, ctx);
    if (isNaN(value) || !isFinite(value)) {
      return { value: 0, error: "Invalid result" };
    }
    return { value: Math.round(value * 100) / 100, error: null };
  } catch (err) {
    return {
      value: 0,
      error: err instanceof Error ? err.message : "Formula error",
    };
  }
}

export function validateFormula(
  formula: string,
  knownVariables: string[],
): string | null {
  const ctx: FormulaContext = { W: 1, H: 1 };
  for (const v of knownVariables) {
    ctx[v] = 1;
  }
  const result = evaluateFormula(formula, ctx);
  return result.error;
}
