/**
 * Unit conversion system for the cutting optimizer.
 * Internal representation is always in millimeters.
 * All user-facing values are converted to/from the display unit.
 */

export const UNITS = {
  mm: { label: 'mm', fullName: 'Millimeters', factor: 1, decimals: 0, system: 'metric' },
  cm: { label: 'cm', fullName: 'Centimeters', factor: 0.1, decimals: 1, system: 'metric' },
  m:  { label: 'm',  fullName: 'Meters',      factor: 0.001, decimals: 3, system: 'metric' },
  in: { label: 'in', fullName: 'Inches',      factor: 1 / 25.4, decimals: 2, system: 'imperial' },
  ft: { label: 'ft', fullName: 'Feet',        factor: 1 / 304.8, decimals: 3, system: 'imperial' },
};

export const MEASUREMENT_SYSTEMS = {
  metric: { label: 'Metric', defaultUnit: 'mm' },
  imperial: { label: 'Imperial', defaultUnit: 'ft' },
};

/**
 * Convert a value from mm (internal) to the display unit.
 * @param {number} mm - Value in millimeters
 * @param {string} unit - Target unit key (mm, cm, m, in, ft)
 * @returns {number}
 */
export function fromMM(mm: number, unit: string) {
  const u = UNITS[unit as keyof typeof UNITS];
  if (!u) return mm;
  return mm * u.factor;
}

/**
 * Convert a value from the display unit to mm (internal).
 * @param {number} value - Value in the display unit
 * @param {string} unit - Source unit key
 * @returns {number}
 */
export function toMM(value: number, unit: string) {
  const u = UNITS[unit as keyof typeof UNITS];
  if (!u) return value;
  return value / u.factor;
}

/**
 * Format a mm value for display in the given unit.
 * @param {number} mm - Value in millimeters
 * @param {string} unit - Display unit key
 * @param {boolean} showUnit - Whether to append the unit label
 * @returns {string}
 */
export function formatLength(mm: number, unit: string, showUnit: boolean = true) {
  const u = UNITS[unit as keyof typeof UNITS];
  if (!u) return `${mm}`;
  const val = mm * u.factor;
  const formatted = val.toFixed(u.decimals);
  return showUnit ? `${formatted} ${u.label}` : formatted;
}

/**
 * Parse a user-entered length string and convert to mm.
 * Handles basic number parsing.
 * @param {string} input - User input string
 * @param {string} unit - Current display unit
 * @returns {number|null} Value in mm, or null if invalid
 */
export function parseLength(input: any, unit: string) {
  const trimmed = String(input).trim();
  if (!trimmed) return null;
  const num = parseFloat(trimmed);
  if (isNaN(num) || num < 0) return null;
  return toMM(num, unit);
}
