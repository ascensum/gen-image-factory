/** UI display for processing.slider sharpening (0–10, 0.5 steps). */
export function formatSharpeningDisplay(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  const clamped = Math.max(0, Math.min(10, n));
  const snapped = Math.round(clamped * 2) / 2;
  return Number.isInteger(snapped) ? String(snapped) : snapped.toFixed(1);
}

/** UI display for saturation (0–2, typically 0.1 steps in settings). */
export function formatSaturationDisplay(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '1';
  const clamped = Math.max(0, Math.min(3, n));
  const snapped = Math.round(clamped * 10) / 10;
  return Number.isInteger(snapped) ? String(snapped) : snapped.toFixed(1);
}
