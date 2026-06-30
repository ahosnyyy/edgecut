import { useState, useEffect, useMemo } from 'react';
import { useApp, ACTIONS } from '../../context/AppContext';
import { fromMM, toMM, formatLength, UNITS, MEASUREMENT_SYSTEMS } from '../../engine/units';
import { useSettings } from '../../hooks/useSettings';
import { Add01Icon, Delete02Icon, RulerIcon, DollarSignIcon, Recycle01Icon, CombineIcon, Alert02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';

export function StockPanel() {
  const { state, dispatch } = useApp();
  const { unit } = state.settings;

  // Detect stock sharing the same length and remnant status (mergeable),
  // tracked separately for standard stock and remnants.
  const { stockGroups, remnantGroups } = useMemo(() => {
    const byKey = new Map(); // `${mm}|${isRemnant}` -> { length, isRemnant, count }
    for (const s of state.stockLengths) {
      const key = `${Math.round(s.length)}|${s.isRemnant ? 1 : 0}`;
      const entry = byKey.get(key) || { length: s.length, isRemnant: !!s.isRemnant, count: 0 };
      entry.count++;
      byKey.set(key, entry);
    }
    const dupes = [...byKey.values()].filter((e: any) => e.count > 1);
    return {
      stockGroups: dupes.filter((e: any) => !e.isRemnant),
      remnantGroups: dupes.filter((e: any) => e.isRemnant),
    };
  }, [state.stockLengths]);

  const buildHint = (groups: any, noun: string) =>
    groups.length === 1
      ? `${groups[0].count} ${noun} share ${formatLength(groups[0].length, unit)}`
      : `${groups.length} ${noun} sizes have duplicates`;

  const hasStockDupes = stockGroups.length > 0;
  const hasRemnantDupes = remnantGroups.length > 0;

  // Detect reused labels within each category (case-insensitive, ignoring blanks).
  const { stockLabelDupes, remnantLabelDupes } = useMemo(() => {
    const dupesFor = (isRemnant: boolean) => {
      const counts = new Map(); // normalized label -> { label, count }
      for (const s of state.stockLengths) {
        if (!!s.isRemnant !== isRemnant) continue;
        const name = (s.label || '').trim();
        if (!name) continue;
        const key = name.toLowerCase();
        const entry = counts.get(key) || { label: name, count: 0 };
        entry.count++;
        counts.set(key, entry);
      }
      return [...counts.values()].filter((e: any) => e.count > 1);
    };
    return { stockLabelDupes: dupesFor(false), remnantLabelDupes: dupesFor(true) };
  }, [state.stockLengths]);

  const buildLabelWarning = (dupes: any, noun: string) =>
    dupes.length === 1
      ? `Label “${dupes[0].label}” is used ${dupes[0].count} times`
      : `${dupes.length} ${noun} labels are reused`;

  const hasStockLabelDupes = stockLabelDupes.length > 0;
  const hasRemnantLabelDupes = remnantLabelDupes.length > 0;

  return (
    <div className="space-y-3">
      {state.stockLengths.map((stock: any) => (
        <StockRow key={stock.id} stock={stock} unit={unit} dispatch={dispatch} />
      ))}

      {/* Merge duplicates hints (stock and remnants kept separate) */}
      {(hasStockDupes || hasRemnantDupes) && (
        <div className={`grid gap-2 ${hasStockDupes && hasRemnantDupes ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {hasStockDupes && (
            <MergeHint
              message={buildHint(stockGroups, 'stock')}
              onMerge={() => dispatch({ type: ACTIONS.MERGE_DUPLICATE_STOCK, payload: { isRemnant: false } })}
            />
          )}
          {hasRemnantDupes && (
            <MergeHint
              message={buildHint(remnantGroups, 'remnant')}
              onMerge={() => dispatch({ type: ACTIONS.MERGE_DUPLICATE_STOCK, payload: { isRemnant: true } })}
            />
          )}
        </div>
      )}

      {/* Duplicate label warnings (non-blocking, kept separate) */}
      {(hasStockLabelDupes || hasRemnantLabelDupes) && (
        <div className={`grid gap-2 ${hasStockLabelDupes && hasRemnantLabelDupes ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {hasStockLabelDupes && <WarnHint message={buildLabelWarning(stockLabelDupes, 'stock')} />}
          {hasRemnantLabelDupes && <WarnHint message={buildLabelWarning(remnantLabelDupes, 'remnant')} />}
        </div>
      )}

      {/* Add Buttons */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button
          variant="outline"
          onClick={() => dispatch({ type: ACTIONS.ADD_STOCK, payload: { length: 5800 } })}
        >
          <HugeiconsIcon icon={Add01Icon} size={14} className="mr-1" /> Stock
        </Button>
        <Button
          variant="outline"
          className="text-muted-foreground"
          onClick={() => dispatch({
            type: ACTIONS.ADD_STOCK,
            payload: { length: 2000, quantity: 1, isRemnant: true }
          })}
        >
          <HugeiconsIcon icon={Recycle01Icon} size={14} className="mr-1" /> Remnant
        </Button>
      </div>
    </div>
  );
}

export function SettingsPanel() {
  const { state, dispatch } = useApp();
  const { unit, measurementSystem, pricePerBar } = state.settings;
  const { kerfWidth: globalKerf, optimizationStrategy: globalStrategy, setKerfWidth, setOptimizationStrategy, displayUnit, fromMM: settingsFromMM, toMM: settingsToMM, unitLabel } = useSettings();

  // Sync global settings to AppContext so the optimizer can use them
  useEffect(() => {
    if (state.settings.kerfWidth !== globalKerf) {
      dispatch({ type: ACTIONS.SET_KERF, payload: globalKerf });
    }
  }, [globalKerf]);

  useEffect(() => {
    if (state.settings.optimizationStrategy !== globalStrategy) {
      dispatch({ type: ACTIONS.SET_OPTIMIZATION_STRATEGY, payload: globalStrategy });
    }
  }, [globalStrategy]);

  const [kerfStr, setKerfStr] = useState('');
  const [priceStr, setPriceStr] = useState('');

  useEffect(() => {
    queueMicrotask(() => setKerfStr(String(settingsFromMM(globalKerf))));
  }, [globalKerf, settingsFromMM]);

  useEffect(() => {
    queueMicrotask(() => setPriceStr(pricePerBar ? String(pricePerBar) : ''));
  }, [pricePerBar]);

  const handleKerfFocus = () => {
    setKerfStr(String(settingsFromMM(globalKerf)));
  };

  const handlePriceFocus = () => {
    setPriceStr(pricePerBar ? String(pricePerBar) : '');
  };

  const availableUnits = Object.entries(UNITS).filter(([, u]) => u.system === measurementSystem);

  const handleSystemChange = (system: keyof typeof MEASUREMENT_SYSTEMS) => {
    const defaultUnit = MEASUREMENT_SYSTEMS[system].defaultUnit;
    dispatch({
      type: ACTIONS.SET_MEASUREMENT_SYSTEM,
      payload: { system, unit: defaultUnit }
    });
  };

  return (
    <div className="space-y-4">
      {/* Measurement System + Unit in one row */}
      <div className="grid grid-cols-[1fr_80px] gap-3 items-end">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Measurement System</Label>
          <Select value={measurementSystem} onValueChange={handleSystemChange}>
            <SelectTrigger className="w-full">
              <SelectValue>{MEASUREMENT_SYSTEMS[measurementSystem as keyof typeof MEASUREMENT_SYSTEMS]?.label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(MEASUREMENT_SYSTEMS).map(([key, sys]: any) => (
                <SelectItem key={key} value={key}>
                  {sys.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Unit</Label>
          <Select value={unit} onValueChange={(v) => dispatch({ type: ACTIONS.SET_UNIT, payload: v })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableUnits.map(([key, u]) => (
                <SelectItem key={key} value={key}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="kerf-input" className="text-xs text-muted-foreground flex items-center gap-1.5">
            <HugeiconsIcon icon={RulerIcon} size={12} /> Kerf ({unitLabel})
          </Label>
          <Input
            id="kerf-input"
            type="number"
            min="0"
            step="0.5"
            value={kerfStr}
            onFocus={handleKerfFocus}
            onChange={(e: any) => {
              const raw = e.target.value;
              setKerfStr(raw);
              const val = parseFloat(raw);
              if (!isNaN(val) && val >= 0) {
                const mm = settingsToMM(val);
                setKerfWidth(mm);
                dispatch({ type: ACTIONS.SET_KERF, payload: mm });
              }
            }}
            onBlur={() => {
              const val = parseFloat(kerfStr);
              if (isNaN(val) || val < 0) {
                setKerfStr(String(settingsFromMM(5)));
                setKerfWidth(5);
                dispatch({ type: ACTIONS.SET_KERF, payload: 5 });
              }
            }}
            className="font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="price-input" className="text-xs text-muted-foreground flex items-center gap-1.5">
            <HugeiconsIcon icon={DollarSignIcon} size={12} /> Price / Bar
          </Label>
          <Input
            id="price-input"
            type="number"
            min="0"
            step="0.01"
            value={priceStr}
            placeholder="0.00"
            onFocus={handlePriceFocus}
            onChange={(e: any) => {
              const raw = e.target.value;
              setPriceStr(raw);
              const val = parseFloat(raw);
              if (!isNaN(val) && val >= 0) {
                dispatch({ type: ACTIONS.SET_PRICE, payload: val });
              }
            }}
            onBlur={() => {
              const val = parseFloat(priceStr);
              if (isNaN(val) || val < 0) {
                setPriceStr('0');
                dispatch({ type: ACTIONS.SET_PRICE, payload: 0 });
              }
            }}
            className="font-mono"
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Optimization Goal</Label>
        <Select
          value={globalStrategy}
          onValueChange={(v: any) => {
            setOptimizationStrategy(v);
            dispatch({ type: ACTIONS.SET_OPTIMIZATION_STRATEGY, payload: v });
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              {globalStrategy === 'maximize_large_bars' ? 'Maximize Large Bars (Default)' : 'Spread Waste'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="maximize_large_bars">Maximize Large Bars (Default)</SelectItem>
            <SelectItem value="balanced">Spread Waste</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground mt-1">
          {globalStrategy === 'maximize_large_bars'
            ? 'Fills large bars to capacity first, leaving long clean cutoffs.'
            : 'Spreads cuts to tightly pack smaller bars first.'}
        </p>
      </div>
    </div>
  );
}

/* ─── Sub-components ── */

function MergeHint({ message, onMerge }: any) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed px-2.5 py-1.5 text-[11px] text-muted-foreground">
      <HugeiconsIcon icon={CombineIcon} size={13} className="shrink-0" />
      <span className="min-w-0 truncate" title={message}>{message}</span>
      <Button variant="outline" size="xs" className="ml-auto shrink-0" onClick={onMerge}>
        Merge
      </Button>
    </div>
  );
}

function WarnHint({ message }: any) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed border-amber-500/40 px-2.5 py-1.5 text-[11px] text-amber-600 dark:text-amber-400">
      <HugeiconsIcon icon={Alert02Icon} size={13} className="shrink-0" />
      <span className="min-w-0 truncate" title={message}>{message}</span>
    </div>
  );
}

function StockRow({ stock, unit, dispatch }: any) {
  const [lengthStr, setLengthStr] = useState('');
  const [qtyStr, setQtyStr] = useState('');

  useEffect(() => {
    queueMicrotask(() => setLengthStr(String(parseFloat(fromMM(stock.length, unit).toFixed(4)))));
  }, [stock.length, unit]);

  useEffect(() => {
    queueMicrotask(() => setQtyStr(stock.quantity === Infinity ? '∞' : String(stock.quantity)));
  }, [stock.quantity]);

  const handleLengthFocus = () => {
    setLengthStr(String(parseFloat(fromMM(stock.length, unit).toFixed(4))));
  };

  const handleQtyFocus = () => {
    setQtyStr(stock.quantity === Infinity ? '∞' : String(stock.quantity));
  };

  const handleLengthChange = (e: any) => {
    const raw = e.target.value;
    setLengthStr(raw);
    const val = parseFloat(raw);
    if (!isNaN(val) && val > 0) {
      dispatch({
        type: ACTIONS.UPDATE_STOCK,
        payload: { id: stock.id, changes: { length: toMM(val, unit) } }
      });
    }
  };

  const handleQtyChange = (e: any) => {
    const raw = e.target.value.trim();
    setQtyStr(raw);
    if (raw === '∞' || raw === '' || raw.toLowerCase() === 'inf') {
      dispatch({
        type: ACTIONS.UPDATE_STOCK,
        payload: { id: stock.id, changes: { quantity: Infinity } }
      });
    } else {
      const val = parseInt(raw, 10);
      if (!isNaN(val) && val > 0) {
        dispatch({
          type: ACTIONS.UPDATE_STOCK,
          payload: { id: stock.id, changes: { quantity: val } }
        });
      }
    }
  };

  const handleLengthBlur = () => {
    const val = parseFloat(lengthStr);
    if (isNaN(val) || val <= 0) {
      setLengthStr(String(parseFloat(fromMM(5800, unit).toFixed(4))));
      dispatch({
        type: ACTIONS.UPDATE_STOCK,
        payload: { id: stock.id, changes: { length: 5800 } }
      });
    }
  };

  const handleQtyBlur = () => {
    const raw = qtyStr.trim();
    if (raw === '∞' || raw === '' || raw.toLowerCase() === 'inf') return;
    const val = parseInt(raw, 10);
    if (isNaN(val) || val <= 0) {
      setQtyStr('∞');
      dispatch({
        type: ACTIONS.UPDATE_STOCK,
        payload: { id: stock.id, changes: { quantity: Infinity } }
      });
    }
  };

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${stock.isRemnant ? 'bg-muted/30 border-dashed' : ''}`}>
      <div className="flex items-center gap-2">
        {stock.isRemnant && (
          <HugeiconsIcon icon={Recycle01Icon} size={12} className="text-purple-600 dark:text-purple-400 shrink-0" />
        )}
        <Input
          type="text"
          value={stock.label}
          onChange={(e: any) => dispatch({
            type: ACTIONS.UPDATE_STOCK,
            payload: { id: stock.id, changes: { label: e.target.value } }
          })}
          placeholder="Label"
          className="flex-1"
        />
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => dispatch({ type: ACTIONS.REMOVE_STOCK, payload: stock.id })}
        >
          <HugeiconsIcon icon={Delete02Icon} size={14} />
        </Button>
      </div>
      {/* Row 2: Length + Quantity */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Length ({unit})</Label>
          <Input
            type="number"
            value={lengthStr}
            onFocus={handleLengthFocus}
            onChange={handleLengthChange}
            onBlur={handleLengthBlur}
            className="font-mono"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Quantity</Label>
          <Input
            type="text"
            value={qtyStr}
            onFocus={handleQtyFocus}
            onChange={handleQtyChange}
            onBlur={handleQtyBlur}
            className="font-mono"
            placeholder="∞"
          />
        </div>
      </div>
    </div>
  );
}

