/**
 * Mirrors src/utils/processing.js `coerceProcessingBoolean` for renderer-only display.
 * SQLite / persisted JSON often stores booleans as strings; `if ("false")` is true in JS.
 */
export function coerceProcessingBoolean(v: unknown): boolean {
  if (v === true) return true;
  if (v === false) return false;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'false' || s === '0' || s === 'no' || s === 'off' || s === '') return false;
    if (s === 'true' || s === '1' || s === 'yes' || s === 'on') return true;
  }
  return Boolean(v);
}
