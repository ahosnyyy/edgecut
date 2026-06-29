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
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const STORAGE_KEY = "edgecut.displayUnit";

function getInitialUnit(): UnitKey {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && stored in UNITS) return stored as UnitKey;
  return "cm";
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [displayUnit, setDisplayUnitState] = useState<UnitKey>(getInitialUnit);

  const measurementSystem: MeasurementSystem =
    UNITS[displayUnit].system as MeasurementSystem;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, displayUnit);
  }, [displayUnit]);

  const setDisplayUnit = useCallback((unit: UnitKey) => {
    setDisplayUnitState(unit);
  }, []);

  const setMeasurementSystem = useCallback((system: MeasurementSystem) => {
    const defaultUnit = MEASUREMENT_SYSTEMS[system].defaultUnit as UnitKey;
    setDisplayUnitState(defaultUnit);
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
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
