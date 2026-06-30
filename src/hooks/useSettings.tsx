import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { UNITS, MEASUREMENT_SYSTEMS, fromMM, toMM, formatLength, parseLength } from "../engine/units";

export type UnitKey = keyof typeof UNITS;
export type MeasurementSystem = keyof typeof MEASUREMENT_SYSTEMS;

interface SettingsContextValue {
  displayUnit: UnitKey;
  measurementSystem: MeasurementSystem;
  setDisplayUnit: (unit: UnitKey) => void;
  setMeasurementSystem: (system: MeasurementSystem) => void;
  fromMM: (mm: number) => number;
  toMM: (value: number) => number;
  formatLength: (mm: number, showUnit?: boolean) => string;
  parseLength: (input: string | number) => number | null;
  unitLabel: string;
  kerfWidth: number;
  setKerfWidth: (mm: number) => void;
  optimizationStrategy: "balanced" | "maximize_large_bars";
  setOptimizationStrategy: (strategy: "balanced" | "maximize_large_bars") => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const STORAGE_KEY = "edgecut.displayUnit";
const KERF_KEY = "edgecut.kerfWidth";
const STRATEGY_KEY = "edgecut.optimizationStrategy";

function getInitialUnit(): UnitKey {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && stored in UNITS) return stored as UnitKey;
  return "cm";
}

function getInitialKerf(): number {
  const stored = localStorage.getItem(KERF_KEY);
  if (stored) {
    const val = parseFloat(stored);
    if (!isNaN(val) && val >= 0) return val;
  }
  return 5;
}

function getInitialStrategy(): "balanced" | "maximize_large_bars" {
  const stored = localStorage.getItem(STRATEGY_KEY);
  if (stored === "balanced" || stored === "maximize_large_bars") return stored;
  return "maximize_large_bars";
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [displayUnit, setDisplayUnitState] = useState<UnitKey>(getInitialUnit);
  const [kerfWidth, setKerfWidthState] = useState<number>(getInitialKerf);
  const [optimizationStrategy, setOptimizationStrategyState] = useState<"balanced" | "maximize_large_bars">(getInitialStrategy);

  const measurementSystem: MeasurementSystem =
    UNITS[displayUnit].system as MeasurementSystem;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, displayUnit);
  }, [displayUnit]);

  useEffect(() => {
    localStorage.setItem(KERF_KEY, String(kerfWidth));
  }, [kerfWidth]);

  useEffect(() => {
    localStorage.setItem(STRATEGY_KEY, optimizationStrategy);
  }, [optimizationStrategy]);

  const setDisplayUnit = useCallback((unit: UnitKey) => {
    setDisplayUnitState(unit);
  }, []);

  const setMeasurementSystem = useCallback((system: MeasurementSystem) => {
    const defaultUnit = MEASUREMENT_SYSTEMS[system].defaultUnit as UnitKey;
    setDisplayUnitState(defaultUnit);
  }, []);

  const setKerfWidth = useCallback((mm: number) => {
    setKerfWidthState(mm);
  }, []);

  const setOptimizationStrategy = useCallback((strategy: "balanced" | "maximize_large_bars") => {
    setOptimizationStrategyState(strategy);
  }, []);

  const value: SettingsContextValue = {
    displayUnit,
    measurementSystem,
    setDisplayUnit,
    setMeasurementSystem,
    fromMM: (mm: number) => fromMM(mm, displayUnit),
    toMM: (val: number) => toMM(val, displayUnit),
    formatLength: (mm: number, showUnit = true) => formatLength(mm, displayUnit, showUnit),
    parseLength: (input: string | number) => parseLength(input, displayUnit),
    unitLabel: UNITS[displayUnit].label,
    kerfWidth,
    setKerfWidth,
    optimizationStrategy,
    setOptimizationStrategy,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
