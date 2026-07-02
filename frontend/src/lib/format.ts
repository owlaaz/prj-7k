/**
 * §4.4 Units — millions (`M`) for damage.
 * Internal storage stays raw; convert only at UI/CSV boundary.
 */

/** formatM(18000000) → "18M", formatM(500000) → "0.5M" */
export function formatM(raw: number): string {
  if (raw === 0) return "0M";
  const m = raw / 1_000_000;
  // Trim trailing zeros while keeping enough decimals for exactness
  const s = parseFloat(m.toPrecision(6)).toString();
  return s + "M";
}

/**
 * parseM("6") → 6000000, parseM("0.5M") → 500000, parseM("6M") → 6000000.
 * Returns NaN for negatives or non-numeric.
 */
export function parseM(str: string): number {
  const trimmed = str.trim().replace(/[Mm]$/, "");
  const n = parseFloat(trimmed);
  if (isNaN(n) || n < 0) return NaN;
  return Math.round(n * 1_000_000);
}

/** Format a raw number as millions with one decimal if needed, no suffix */
export function formatMNumber(raw: number): number {
  return raw / 1_000_000;
}

/** Boss names (0-indexed). Falls back to "Boss N" for indices beyond the list. */
const BOSS_NAMES = ["Teo", "Kyle", "Yeonhee", "Karma"];

export function bossName(index: number): string {
  return BOSS_NAMES[index] ?? `Boss ${index + 1}`;
}
