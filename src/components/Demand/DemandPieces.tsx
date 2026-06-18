import { useState, useEffect, useMemo } from 'react';
import { useApp, ACTIONS } from '../../context/AppContext';
import { fromMM, toMM, formatLength } from '../../engine/units';
import { Add01Icon, Delete02Icon, CombineIcon, Alert02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export default function DemandPieces() {
  const { state, dispatch } = useApp();
  const { unit } = state.settings;

  const hasPieces = state.demandPieces.length > 0;

  // Detect pieces that share a length and could be merged.
  const duplicateGroups = useMemo(() => {
    const byLength = new Map(); // rounded mm -> { length, count }
    for (const p of state.demandPieces) {
      const key = Math.round(p.length);
      const entry = byLength.get(key) || { length: p.length, count: 0 };
      entry.count++;
      byLength.set(key, entry);
    }
    return [...byLength.values()].filter((e: any) => e.count > 1);
  }, [state.demandPieces]);

  const mergeHint = duplicateGroups.length === 1
    ? `${duplicateGroups[0].count} pieces share ${formatLength(duplicateGroups[0].length, unit)}`
    : `${duplicateGroups.length} lengths have duplicate pieces`;

  // Detect labels reused across pieces (case-insensitive, ignoring blanks).
  const duplicateLabels = useMemo(() => {
    const counts = new Map(); // normalized label -> { label, count }
    for (const p of state.demandPieces) {
      const name = (p.label || '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const entry = counts.get(key) || { label: name, count: 0 };
      entry.count++;
      counts.set(key, entry);
    }
    return [...counts.values()].filter((e: any) => e.count > 1);
  }, [state.demandPieces]);

  const labelWarning = duplicateLabels.length === 1
    ? `Label “${duplicateLabels[0].label}” is used ${duplicateLabels[0].count} times`
    : `${duplicateLabels.length} labels are used more than once`;

  return (
    <div className="space-y-2">
      {hasPieces && (
        <>
          {/* Column Headers */}
          <div className="grid grid-cols-[auto_1fr_100px_64px_32px] gap-2 items-center py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium border-b">
            <div className="w-3"></div>
            <div>Label</div>
            <div>Length ({unit})</div>
            <div>Qty</div>
            <div></div>
          </div>

          {/* Piece Rows */}
          <div className="divide-y">
            {state.demandPieces.map((piece: any) => (
              <PieceRow 
                key={piece.id} 
                piece={piece} 
                unit={unit} 
                dispatch={dispatch} 
              />
            ))}
          </div>

          {/* Add another */}
          <Button
            variant="ghost"
            className="w-full text-muted-foreground hover:text-foreground border border-dashed"
            onClick={() => dispatch({ type: ACTIONS.ADD_PIECE })}
          >
            <HugeiconsIcon icon={Add01Icon} size={14} className="mr-1.5" /> Add another piece
          </Button>

          {/* Merge duplicates hint */}
          {duplicateGroups.length > 0 && (
            <div className="flex items-center gap-2 rounded-md border border-dashed px-2.5 py-1.5 text-[11px] text-muted-foreground">
              <HugeiconsIcon icon={CombineIcon} size={13} className="shrink-0" />
              <span>{mergeHint}</span>
              <Button
                variant="outline"
                size="xs"
                className="ml-auto"
                onClick={() => dispatch({ type: ACTIONS.MERGE_DUPLICATE_PIECES })}
              >
                Merge
              </Button>
            </div>
          )}

          {/* Duplicate label warning (non-blocking) */}
          {duplicateLabels.length > 0 && (
            <div className="flex items-center gap-2 rounded-md border border-dashed border-amber-500/40 px-2.5 py-1.5 text-[11px] text-amber-600 dark:text-amber-400">
              <HugeiconsIcon icon={Alert02Icon} size={13} className="shrink-0" />
              <span>{labelWarning}</span>
            </div>
          )}
        </>
      )}

      {/* Empty State with inline Add button */}
      {!hasPieces && (
        <div className="py-12 flex flex-col items-center justify-center text-center gap-4">
          <div className="text-sm text-muted-foreground">
            No demand pieces yet.
          </div>
          <Button
            variant="outline"
            onClick={() => dispatch({ type: ACTIONS.ADD_PIECE })}
          >
            <HugeiconsIcon icon={Add01Icon} size={14} className="mr-1.5" /> Add First Piece
          </Button>
        </div>
      )}
    </div>
  );
}

function PieceRow({ piece, unit, dispatch }: any) {
  const { getColorForLength } = useApp();
  const color = getColorForLength(piece.length);

  const [lengthStr, setLengthStr] = useState('');
  const [qtyStr, setQtyStr] = useState('');

  useEffect(() => {
    queueMicrotask(() => setLengthStr(String(parseFloat(fromMM(piece.length, unit).toFixed(4)))));
  }, [piece.length, unit]);

  useEffect(() => {
    queueMicrotask(() => setQtyStr(String(piece.quantity)));
  }, [piece.quantity]);

  const handleLengthFocus = () => {
    setLengthStr(String(parseFloat(fromMM(piece.length, unit).toFixed(4))));
  };

  const handleQtyFocus = () => {
    setQtyStr(String(piece.quantity));
  };

  const handleLengthChange = (e: any) => {
    const raw = e.target.value;
    setLengthStr(raw);
    const val = parseFloat(raw);
    if (!isNaN(val) && val > 0) {
      dispatch({
        type: ACTIONS.UPDATE_PIECE,
        payload: { id: piece.id, changes: { length: toMM(val, unit) } }
      });
    }
  };

  const handleQtyChange = (e: any) => {
    const raw = e.target.value;
    setQtyStr(raw);
    const val = parseInt(raw, 10);
    if (!isNaN(val) && val > 0) {
      dispatch({
        type: ACTIONS.UPDATE_PIECE,
        payload: { id: piece.id, changes: { quantity: val } }
      });
    }
  };

  const handleLengthBlur = () => {
    const val = parseFloat(lengthStr);
    if (isNaN(val) || val <= 0) {
      setLengthStr(String(parseFloat(fromMM(720, unit).toFixed(4))));
      dispatch({
        type: ACTIONS.UPDATE_PIECE,
        payload: { id: piece.id, changes: { length: 720 } }
      });
    }
  };

  const handleQtyBlur = () => {
    const val = parseInt(qtyStr, 10);
    if (isNaN(val) || val <= 0) {
      setQtyStr('2');
      dispatch({
        type: ACTIONS.UPDATE_PIECE,
        payload: { id: piece.id, changes: { quantity: 2 } }
      });
    }
  };

  return (
    <div className="grid grid-cols-[auto_1fr_100px_64px_32px] gap-2 items-center py-2 hover:bg-muted/30 transition-colors rounded-md px-1">
      {/* Color dot */}
      <div className="flex items-center justify-center">
        <div
          className="w-3 h-3 rounded-full ring-1 ring-black/10 dark:ring-white/10"
          style={{ background: color }}
        />
      </div>

      {/* Label */}
      <Input
        value={piece.label}
        onChange={(e: any) => dispatch({
          type: ACTIONS.UPDATE_PIECE,
          payload: { id: piece.id, changes: { label: e.target.value } }
        })}
        placeholder="Piece name"
      />

      {/* Length */}
      <div className="flex items-center">
        <Input
          type="number"
          value={lengthStr}
          onFocus={handleLengthFocus}
          onChange={handleLengthChange}
          onBlur={handleLengthBlur}
          className="font-mono"
        />
      </div>

      {/* Quantity */}
      <div className="flex items-center">
        <Input
          type="number"
          value={qtyStr}
          onFocus={handleQtyFocus}
          onChange={handleQtyChange}
          onBlur={handleQtyBlur}
          className="font-mono"
        />
      </div>

      {/* Delete */}
      <div className="flex justify-center">
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => dispatch({ type: ACTIONS.REMOVE_PIECE, payload: piece.id })}
        >
          <HugeiconsIcon icon={Delete02Icon} size={14} />
        </Button>
      </div>
    </div>
  );
}
