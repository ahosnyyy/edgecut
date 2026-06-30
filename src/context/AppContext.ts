import { createContext, useContext } from 'react';
import { optimize, recalculateSummary, removePieceFromBar, addPieceToBar, reorganizeBars } from '../engine/optimizer';

// ─── ID Generator ────────────────────────────────────────────────
let _id = 0;
const genId = (prefix: string) => `${prefix}-${++_id}`;

// ─── Cookie helpers ──────────────────────────────────────────────
function setCookie(name: string, value: string, days: number = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Strict`;
}

function getCookie(name: string) {
  return document.cookie.split('; ').reduce((r, v) => {
    const parts = v.split('=');
    return parts[0] === name ? decodeURIComponent(parts[1]) : r;
  }, '');
}

// ─── Initial State ───────────────────────────────────────────────

export type Settings = {
  unit: string;
  measurementSystem: 'metric' | 'imperial';
  kerfWidth: number;
  pricePerBar: number;
  theme: 'light' | 'dark' | 'auto';
  optimizationStrategy: 'balanced' | 'maximize_large_bars';
};

export type Stock = {
  id: string;
  length: number;
  quantity: number;
  isRemnant: boolean;
  label: string;
  isLabelCustom?: boolean;
};

export type Piece = {
  id: string;
  label: string;
  length: number;
  quantity: number;
  isLabelCustom?: boolean;
};

export type BarPiece = Piece & {
  offset: number;
  instanceIndex: number;
  pieceId: string;
};

export type Bar = {
  id: string;
  stockLengthId: string;
  stockLength: number;
  isRemnant: boolean;
  pieces: BarPiece[];
  usedLength: number;
  waste: number;
  wastePercent: number;
};

export type AppState = {
  settings: Settings;
  stockLengths: Stock[];
  demandPieces: Piece[];
  cuttingPlan: { bars: Bar[]; summary: any; unplaced?: any } | null;
  overrides: Record<string, any>;
  validationErrors: string[];
  isOptimized: boolean;
  optimizeAnimation: boolean;
};

export function createInitialState(): AppState {
  const savedTheme = getCookie('theme');
  const theme = savedTheme === 'dark' ? 'dark' : 'light';

  let savedSettings: Partial<Settings> = {};
  try {
    const stored = localStorage.getItem('edgecut_settings');
    if (stored) {
      savedSettings = JSON.parse(stored);
    }
  } catch (e) {}

  return {
    settings: {
      unit: savedSettings.unit || 'cm',
      measurementSystem: savedSettings.measurementSystem || 'metric', // 'metric' | 'imperial'
      kerfWidth: savedSettings.kerfWidth ?? 5,        // in mm always (internal)
      pricePerBar: savedSettings.pricePerBar ?? 0,
      theme: savedSettings.theme || theme,               // 'light' | 'dark'
      optimizationStrategy: savedSettings.optimizationStrategy || 'maximize_large_bars', // 'balanced' | 'maximize_large_bars'
    },

    stockLengths: [
      { id: genId('stk'), length: 6000, quantity: Infinity, isRemnant: false, label: 'Standard 6m Bar' },
    ],

    demandPieces: [
      { id: genId('pce'), label: 'Piece 1', length: 720, quantity: 2 },
    ],

    cuttingPlan: null,  // Set after optimization

    overrides: {},

    // UI state
    validationErrors: [],
    isOptimized: false,
    optimizeAnimation: false,
  };
}

// ─── Action Types ────────────────────────────────────────────────
export const ACTIONS = {
  // Settings
  SET_UNIT: 'SET_UNIT',
  SET_MEASUREMENT_SYSTEM: 'SET_MEASUREMENT_SYSTEM',
  SET_KERF: 'SET_KERF',
  SET_PRICE: 'SET_PRICE',
  SET_THEME: 'SET_THEME',
  SET_OPTIMIZATION_STRATEGY: 'SET_OPTIMIZATION_STRATEGY',

  // Stock
  ADD_STOCK: 'ADD_STOCK',
  UPDATE_STOCK: 'UPDATE_STOCK',
  REMOVE_STOCK: 'REMOVE_STOCK',
  MERGE_DUPLICATE_STOCK: 'MERGE_DUPLICATE_STOCK',
  SET_STOCK_LENGTHS: 'SET_STOCK_LENGTHS',

  // Demand pieces
  ADD_PIECE: 'ADD_PIECE',
  UPDATE_PIECE: 'UPDATE_PIECE',
  REMOVE_PIECE: 'REMOVE_PIECE',
  MERGE_DUPLICATE_PIECES: 'MERGE_DUPLICATE_PIECES',
  SET_DEMAND_PIECES: 'SET_DEMAND_PIECES',

  // Optimization
  RUN_OPTIMIZE: 'RUN_OPTIMIZE',
  CLEAR_PLAN: 'CLEAR_PLAN',
  SET_VALIDATION_ERRORS: 'SET_VALIDATION_ERRORS',
  SET_OPTIMIZE_ANIMATION: 'SET_OPTIMIZE_ANIMATION',

  // Overrides
  MOVE_PIECE: 'MOVE_PIECE',
  SWAP_PIECES: 'SWAP_PIECES',
  REMOVE_PIECE_FROM_BAR: 'REMOVE_PIECE_FROM_BAR',
  ADD_EMPTY_BAR: 'ADD_EMPTY_BAR',
  REMOVE_BAR: 'REMOVE_BAR',
};

// ─── Reducer ─────────────────────────────────────────────────────
export function appReducer(state: AppState, action: any): AppState {
  const nextState = _appReducer(state, action);
  
  if (['SET_UNIT', 'SET_MEASUREMENT_SYSTEM', 'SET_KERF', 'SET_PRICE', 'SET_THEME', 'SET_OPTIMIZATION_STRATEGY'].includes(action.type)) {
    try {
      localStorage.setItem('edgecut_settings', JSON.stringify(nextState.settings));
    } catch(e) {}
  }
  
  return nextState;
}

function _appReducer(state: AppState, action: any): AppState {
  switch (action.type) {

    // ── Settings ──
    case ACTIONS.SET_UNIT:
      return {
        ...state,
        settings: { ...state.settings, unit: action.payload },
      };

    case ACTIONS.SET_MEASUREMENT_SYSTEM:
      return {
        ...state,
        settings: { ...state.settings, measurementSystem: action.payload.system, unit: action.payload.unit },
      };

    case ACTIONS.SET_KERF:
      return {
        ...state,
        settings: { ...state.settings, kerfWidth: action.payload },
        isOptimized: false,
        cuttingPlan: null,
      };

    case ACTIONS.SET_PRICE:
      return {
        ...state,
        settings: { ...state.settings, pricePerBar: action.payload },
      };

    case ACTIONS.SET_THEME:
      setCookie('theme', action.payload);
      return {
        ...state,
        settings: { ...state.settings, theme: action.payload },
      };

    case ACTIONS.SET_OPTIMIZATION_STRATEGY:
      return {
        ...state,
        settings: { ...state.settings, optimizationStrategy: action.payload },
        isOptimized: false,
        cuttingPlan: null,
      };

    // ── Stock ──
    case ACTIONS.ADD_STOCK: {
      const isRemnant = action.payload?.isRemnant || false;
      // Number labels per category so remnants read "Remnant 1", "Remnant 2", …
      const sameTypeCount = state.stockLengths.filter(s => !!s.isRemnant === isRemnant).length;
      const defaultLabel = isRemnant
        ? `Remnant ${sameTypeCount + 1}`
        : `Stock ${sameTypeCount + 1}`;
      return {
        ...state,
        stockLengths: [...state.stockLengths, {
          id: genId('stk'),
          length: action.payload?.length || 5800,
          quantity: action.payload?.quantity ?? Infinity,
          isRemnant,
          label: action.payload?.label || defaultLabel,
        }],
        isOptimized: false,
        cuttingPlan: null,
      };
    }

    case ACTIONS.UPDATE_STOCK: {
      const stockId = action.payload.id;
      const changes = action.payload.changes;
      const keys = Object.keys(changes);
      const isOnlyLabelChange = keys.length === 1 && keys[0] === 'label';
      const labelTouched = keys.includes('label');

      let newCuttingPlan = state.cuttingPlan;
      let newIsOptimized = state.isOptimized;

      if (!isOnlyLabelChange) {
        newCuttingPlan = null;
        newIsOptimized = false;
      } else if (newCuttingPlan) {
        newCuttingPlan = {
          ...newCuttingPlan,
          bars: newCuttingPlan.bars.map((bar: any) =>
            bar.stockLengthId === stockId ? { ...bar, stockLabel: changes.label } : bar
          )
        };
      }

      return {
        ...state,
        stockLengths: state.stockLengths.map(s =>
          s.id === stockId
            ? { ...s, ...changes, ...(labelTouched ? { isLabelCustom: true } : {}) }
            : s
        ),
        isOptimized: newIsOptimized,
        cuttingPlan: newCuttingPlan,
      };
    }

    case ACTIONS.REMOVE_STOCK:
      return {
        ...state,
        stockLengths: state.stockLengths.filter(s => s.id !== action.payload),
        isOptimized: false,
        cuttingPlan: null,
      };

    case ACTIONS.SET_STOCK_LENGTHS:
      return {
        ...state,
        stockLengths: action.payload,
        isOptimized: false,
        cuttingPlan: null,
      };

    case ACTIONS.MERGE_DUPLICATE_STOCK: {
      // Fold stock sharing the same length AND remnant status into the first
      // occurrence, summing quantities (Infinity stays Infinity). Remnants are
      // never merged with standard stock. A custom label is preferred.
      // An optional `isRemnant` payload scopes the merge to only standard
      // stock (false) or only remnants (true); omit it to merge both.
      const scope = action.payload?.isRemnant; // boolean | undefined
      const merged: Stock[] = [];
      const firstIndexByKey = new Map<string, number>(); // `${mm}|${isRemnant}` -> index in merged
      for (const stock of state.stockLengths) {
        const inScope = scope === undefined || (!!stock.isRemnant === scope);
        if (!inScope) {
          merged.push(stock);
          continue;
        }
        const key = `${Math.round(stock.length)}|${stock.isRemnant ? 1 : 0}`;
        if (firstIndexByKey.has(key)) {
          const idx = firstIndexByKey.get(key)!;
          const existing = merged[idx];
          const adoptCustomLabel = !existing.isLabelCustom && stock.isLabelCustom;
          merged[idx] = {
            ...existing,
            quantity: existing.quantity + stock.quantity,
            ...(adoptCustomLabel ? { label: stock.label, isLabelCustom: true } : {}),
          };
        } else {
          merged.push({ ...stock });
          firstIndexByKey.set(key, merged.length - 1);
        }
      }

      if (merged.length === state.stockLengths.length) return state;

      return {
        ...state,
        stockLengths: merged,
        isOptimized: false,
        cuttingPlan: null,
      };
    }

    // ── Demand Pieces ──
    case ACTIONS.ADD_PIECE: {
      const length = action.payload?.length || 500;
      return {
        ...state,
        demandPieces: [...state.demandPieces, {
          id: genId('pce'),
          label: action.payload?.label || `Piece ${state.demandPieces.length + 1}`,
          length,
          quantity: action.payload?.quantity || 1,
        }],
        isOptimized: false,
        cuttingPlan: null,
      };
    }

    case ACTIONS.UPDATE_PIECE: {
      const pieceId = action.payload.id;
      const changes = action.payload.changes;
      const keys = Object.keys(changes);
      const isOnlyLabelChange = keys.length === 1 && keys[0] === 'label';
      const labelTouched = keys.includes('label');

      let newCuttingPlan = state.cuttingPlan;
      let newIsOptimized = state.isOptimized;

      if (!isOnlyLabelChange) {
        newCuttingPlan = null;
        newIsOptimized = false;
      } else if (newCuttingPlan) {
        newCuttingPlan = {
          ...newCuttingPlan,
          bars: newCuttingPlan.bars.map((bar: any) => ({
            ...bar,
            pieces: bar.pieces.map((p: any) =>
              p.pieceId === pieceId ? { ...p, label: changes.label } : p
            )
          }))
        };
      }

      const demandPieces = state.demandPieces.map(p =>
        p.id === pieceId
          ? { ...p, ...changes, ...(labelTouched ? { isLabelCustom: true } : {}) }
          : p
      );

      return {
        ...state,
        demandPieces,
        isOptimized: newIsOptimized,
        cuttingPlan: newCuttingPlan,
      };
    }

    case ACTIONS.REMOVE_PIECE:
      return {
        ...state,
        demandPieces: state.demandPieces.filter(p => p.id !== action.payload),
        isOptimized: false,
        cuttingPlan: null,
      };

    case ACTIONS.MERGE_DUPLICATE_PIECES: {
      // Fold pieces sharing the same length into the first occurrence,
      // summing quantities. If any piece in the group has a user-customized
      // label, that label is preferred for the merged row.
      const merged: Piece[] = [];
      const firstIndexByLength = new Map<number, number>(); // rounded mm -> index in merged

      for (const piece of state.demandPieces) {
        const key = Math.round(piece.length);
        if (firstIndexByLength.has(key)) {
          const idx = firstIndexByLength.get(key)!;
          const existing = merged[idx];
          const adoptCustomLabel = !existing.isLabelCustom && piece.isLabelCustom;
          merged[idx] = {
            ...existing,
            quantity: existing.quantity + piece.quantity,
            ...(adoptCustomLabel ? { label: piece.label, isLabelCustom: true } : {}),
          };
        } else {
          merged.push({ ...piece });
          firstIndexByLength.set(key, merged.length - 1);
        }
      }

      if (merged.length === state.demandPieces.length) return state;

      return {
        ...state,
        demandPieces: merged,
        isOptimized: false,
        cuttingPlan: null,
      };
    }

    case ACTIONS.SET_DEMAND_PIECES:
      return {
        ...state,
        demandPieces: action.payload,
        isOptimized: false,
        cuttingPlan: null,
      };

    // ── Optimization ──
    case ACTIONS.RUN_OPTIMIZE: {
      const result = optimize({
        stockLengths: state.stockLengths,
        demandPieces: state.demandPieces,
        kerfWidth: state.settings.kerfWidth,
        optimizationStrategy: state.settings.optimizationStrategy,
      });
      return {
        ...state,
        cuttingPlan: result,
        isOptimized: true,
        validationErrors: [],
      };
    }

    case ACTIONS.CLEAR_PLAN:
      return {
        ...state,
        cuttingPlan: null,
        isOptimized: false,
        validationErrors: [],
        overrides: {},
      };

    case ACTIONS.SET_VALIDATION_ERRORS:
      return {
        ...state,
        validationErrors: action.payload,
      };

    case ACTIONS.SET_OPTIMIZE_ANIMATION:
      return {
        ...state,
        optimizeAnimation: action.payload,
      };

    // ── Overrides ──

    case ACTIONS.MOVE_PIECE: {
      const { pieceId, instanceIndex, fromBarId, toBarId } = action.payload;
      if (!state.cuttingPlan || fromBarId === toBarId) return state;

      const fromBar = state.cuttingPlan.bars.find(b => b.id === fromBarId);
      const toBar = state.cuttingPlan.bars.find(b => b.id === toBarId);
      if (!fromBar || !toBar) return state;

      const piece = fromBar.pieces.find(
        p => p.pieceId === pieceId && p.instanceIndex === instanceIndex
      );
      if (!piece) return state;

      // Remove from source bar
      const updatedFromBar = removePieceFromBar(fromBar, pieceId, instanceIndex, state.settings.kerfWidth);

      // Add to target bar
      const updatedToBar = addPieceToBar(toBar, piece, state.settings.kerfWidth);
      if (!updatedToBar) return state; // Doesn't fit

      // Update bars array
      let newBars = state.cuttingPlan.bars.map(b => {
        if (b.id === fromBarId) return updatedFromBar;
        if (b.id === toBarId) return updatedToBar;
        return b;
      });

      // Remove empty bars, then reorganize like the optimizer does
      newBars = reorganizeBars(
        newBars.filter(b => b.pieces.length > 0),
        state.settings.kerfWidth
      );

      const newSummary = recalculateSummary(newBars);

      return {
        ...state,
        cuttingPlan: {
          bars: newBars,
          summary: newSummary,
        },
      };
    }

    case ACTIONS.REMOVE_PIECE_FROM_BAR: {
      const { pieceId, instanceIndex, barId } = action.payload;
      if (!state.cuttingPlan) return state;

      const bar = state.cuttingPlan.bars.find(b => b.id === barId);
      if (!bar) return state;

      const updatedBar = removePieceFromBar(bar, pieceId, instanceIndex, state.settings.kerfWidth);

      let newBars = state.cuttingPlan.bars.map(b =>
        b.id === barId ? updatedBar : b
      );
      newBars = newBars.filter(b => b.pieces.length > 0);

      const newSummary = recalculateSummary(newBars);

      return {
        ...state,
        cuttingPlan: {
          bars: newBars,
          summary: newSummary,
        },
      };
    }

    case ACTIONS.SWAP_PIECES: {
      const { pieceAId, instanceAIndex, barAId, pieceBId, instanceBIndex, barBId } = action.payload;
      if (!state.cuttingPlan || barAId === barBId) return state;

      const barA = state.cuttingPlan.bars.find(b => b.id === barAId);
      const barB = state.cuttingPlan.bars.find(b => b.id === barBId);
      if (!barA || !barB) return state;

      const pieceA = barA.pieces.find(p => p.pieceId === pieceAId && p.instanceIndex === instanceAIndex);
      const pieceB = barB.pieces.find(p => p.pieceId === pieceBId && p.instanceIndex === instanceBIndex);
      if (!pieceA || !pieceB) return state;

      // Remove pieces from their bars
      const barAWithoutA = removePieceFromBar(barA, pieceAId, instanceAIndex, state.settings.kerfWidth);
      const barBWithoutB = removePieceFromBar(barB, pieceBId, instanceBIndex, state.settings.kerfWidth);

      // Add pieces to their new bars
      const updatedBarA = addPieceToBar(barAWithoutA, pieceB, state.settings.kerfWidth);
      const updatedBarB = addPieceToBar(barBWithoutB, pieceA, state.settings.kerfWidth);

      if (!updatedBarA || !updatedBarB) return state; // Swap invalid (doesn't fit)

      let newBars = state.cuttingPlan.bars.map(b => {
        if (b.id === barAId) return updatedBarA;
        if (b.id === barBId) return updatedBarB;
        return b;
      });

      // Reorganize like the optimizer does
      newBars = reorganizeBars(newBars, state.settings.kerfWidth);

      const newSummary = recalculateSummary(newBars);

      return {
        ...state,
        cuttingPlan: { bars: newBars, summary: newSummary },
      };
    }

    case ACTIONS.ADD_EMPTY_BAR: {
      const { stockLengthId } = action.payload;
      if (!state.cuttingPlan) return state;
      
      const stock = state.stockLengths.find(s => s.id === stockLengthId);
      if (!stock) return state;

      const newBar = {
        // Need to import genId if it wasn't exported, wait, genId is inside this file!
        id: genId('bar'),
        stockLengthId: stock.id,
        stockLength: stock.length,
        isRemnant: stock.isRemnant || false,
        pieces: [],
        usedLength: 0,
        waste: stock.length,
        wastePercent: 100,
      };

      const newBars = [...state.cuttingPlan.bars, newBar];
      const newSummary = recalculateSummary(newBars);

      return {
        ...state,
        cuttingPlan: { bars: newBars, summary: newSummary }
      };
    }

    case ACTIONS.REMOVE_BAR: {
      const { barId } = action.payload;
      if (!state.cuttingPlan) return state;

      const newBars = state.cuttingPlan.bars.filter(b => b.id !== barId);
      const newSummary = recalculateSummary(newBars);

      return {
        ...state,
        cuttingPlan: { bars: newBars, summary: newSummary }
      };
    }

    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────
export const AppContext = createContext<any>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export default AppContext;
