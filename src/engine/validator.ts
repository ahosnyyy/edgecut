/**
 * Input validation for the cutting optimizer.
 */

import { AppState } from '../context/AppContext';

/**
 * Validate the entire input state before optimization.
 * Returns an object with { valid: boolean, errors: string[] }
 */
export function validateInput(state: AppState) {
  const errors = [];

  // Validate stock lengths
  if (!state.stockLengths || state.stockLengths.length === 0) {
    errors.push('Add at least one stock length.');
  } else {
    state.stockLengths.forEach((stock, i) => {
      if (!stock.length || stock.length <= 0) {
        errors.push(`Stock #${i + 1}: Length must be greater than 0.`);
      }
      if (stock.quantity !== Infinity && (!stock.quantity || stock.quantity <= 0)) {
        errors.push(`Stock #${i + 1}: Quantity must be greater than 0.`);
      }
    });
  }

  // Validate demand pieces
  if (!state.demandPieces || state.demandPieces.length === 0) {
    errors.push('Add at least one demand piece.');
  } else {
    state.demandPieces.forEach((piece, i) => {
      if (!piece.length || piece.length <= 0) {
        errors.push(`Piece "${piece.label || i + 1}": Length must be greater than 0.`);
      }
      if (!piece.quantity || piece.quantity <= 0) {
        errors.push(`Piece "${piece.label || i + 1}": Quantity must be greater than 0.`);
      }
    });
  }

  // Validate kerf
  if (state.settings.kerfWidth < 0) {
    errors.push('Kerf width cannot be negative.');
  }

  // Check that at least one piece fits in at least one stock
  if (errors.length === 0) {
    const maxStock = Math.max(...state.stockLengths.map(s => s.length));
    const longestPiece = Math.max(...state.demandPieces.map(p => p.length));
    if (longestPiece > maxStock) {
      errors.push(
        `Piece length (${longestPiece}mm) exceeds the largest stock (${maxStock}mm). No piece can be longer than available stock.`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
