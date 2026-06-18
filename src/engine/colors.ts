/**
 * Deterministic color generation for piece lengths.
 * Same length always produces the same visually-distinct color.
 *
 * Colors are drawn from a curated Tailwind/shadcn accent palette
 * (500–600 shades, all chosen to remain legible under white text).
 * Lengths are assigned palette entries in order of first appearance;
 * once the palette is exhausted it cycles with a progressive darkening
 * step so additional lengths stay distinguishable.
 */

// Tailwind 500/600 accent colors as [hue, saturation, lightness].
// Ordered so adjacent entries contrast strongly.
const PALETTE = [
  [217, 91, 60], // blue-500
  [160, 84, 39], // emerald-500
  [25, 95, 53],  // orange-500
  [258, 90, 66], // violet-500
  [330, 81, 60], // pink-500
  [192, 91, 36], // cyan-600
  [38, 92, 50],  // amber-500
  [239, 84, 67], // indigo-500
  [142, 71, 45], // green-600
  [350, 89, 60], // rose-500
  [199, 89, 48], // sky-500
  [85, 78, 35],  // lime-600
  [271, 91, 65], // purple-500
  [173, 80, 40], // teal-500
  [293, 69, 49], // fuchsia-600
  [0, 84, 60],   // red-500
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Cache: mm length → color string
const colorCache = new Map<number, string>();

// Track unique lengths in order of first appearance for index-based hue offset
const lengthRegistry: number[] = [];

/**
 * Register a length and return its stable index.
 * Lengths are registered on first encounter so colors remain
 * consistent within a session regardless of order changes.
 */
function getLengthIndex(lengthMM: number) {
  const rounded = Math.round(lengthMM);
  let idx = lengthRegistry.indexOf(rounded);
  if (idx === -1) {
    idx = lengthRegistry.length;
    lengthRegistry.push(rounded);
  }
  return idx;
}

/**
 * Generate a visually distinct HSL color for a given piece length (mm).
 * Pieces with the same length (rounded to nearest mm) get the same color.
 *
 * @param {number} lengthMM - Piece length in millimeters
 * @returns {string} HSL color string
 */
export function getColorForLength(lengthMM: number) {
  const rounded = Math.round(lengthMM);

  if (colorCache.has(rounded)) {
    return colorCache.get(rounded);
  }

  const idx = getLengthIndex(rounded);
  const [hue, saturation, baseLightness] = PALETTE[idx % PALETTE.length];

  // Darken progressively on each full pass through the palette so
  // wrapped-around lengths stay distinct while keeping white text legible.
  const cycle = Math.floor(idx / PALETTE.length);
  const lightness = clamp(baseLightness - cycle * 9, 30, baseLightness);

  const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  colorCache.set(rounded, color);
  return color;
}

/**
 * Reset the color registry. Useful if you want a fresh palette
 * (e.g., after clearing all pieces).
 */
export function resetColorRegistry() {
  colorCache.clear();
  lengthRegistry.length = 0;
}

/**
 * Get all currently registered length→color mappings.
 * Useful for rendering a legend.
 *
 * @returns {Array<{length: number, color: string}>}
 */
export function getColorLegend() {
  return lengthRegistry.map(len => ({
    length: len,
    color: colorCache.get(len),
  }));
}

/**
 * Convert HSL to RGB array.
 * @param {number} h Hue (0-360)
 * @param {number} s Saturation (0-100)
 * @param {number} l Lightness (0-100)
 * @returns {[number, number, number]} RGB array [r, g, b]
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
}

/**
 * Generate a distinct RGB color for a given piece length (mm).
 * Used for pure jsPDF generation which works best with RGB arrays.
 * 
 * @param {number} lengthMM - Piece length in millimeters
 * @returns {[number, number, number]} RGB color array
 */
export function getRGBForLength(lengthMM: number): [number, number, number] {
  const rounded = Math.round(lengthMM);
  const idx = getLengthIndex(rounded);
  const [hue, saturation, baseLightness] = PALETTE[idx % PALETTE.length];
  const cycle = Math.floor(idx / PALETTE.length);
  const lightness = clamp(baseLightness - cycle * 9, 30, baseLightness);
  
  return hslToRgb(hue, saturation, lightness);
}
