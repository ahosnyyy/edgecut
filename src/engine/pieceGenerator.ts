import { evaluateFormula, type FormulaContext } from "./formula";

export interface TemplateVariable {
  name: string;
  defaultValue: number;
}

export interface TemplatePiece {
  id: string;
  label: string;
  profileType: string;
  lengthFormula: string;
  quantity: number;
}

export interface GeneratedPiece {
  label: string;
  profileType: string;
  length: number;
  quantity: number;
  sourcePieceId: string;
}

export function generatePieces(
  pieces: TemplatePiece[],
  variables: TemplateVariable[],
  width: number,
  height: number,
): { pieces: GeneratedPiece[]; errors: string[] } {
  const ctx: FormulaContext = { W: width, H: height };
  for (const v of variables) {
    ctx[v.name] = v.defaultValue;
  }

  const result: GeneratedPiece[] = [];
  const errors: string[] = [];

  for (const piece of pieces) {
    const evalResult = evaluateFormula(piece.lengthFormula, ctx);
    if (evalResult.error) {
      errors.push(`${piece.label}: ${evalResult.error}`);
      continue;
    }
    result.push({
      label: piece.label,
      profileType: piece.profileType,
      length: evalResult.value,
      quantity: piece.quantity,
      sourcePieceId: piece.id,
    });
  }

  return { pieces: result, errors };
}
