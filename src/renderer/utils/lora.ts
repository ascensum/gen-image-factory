/**
 * LoRA list parsing for Settings and Edit Job Settings.
 * Format: one entry per line, "model:weight" where weight is optional.
 * Model IDs can contain colons (e.g. civitai:144142@160130), so we treat only
 * the segment after the last colon as weight, and only when it's a number in 0–10.
 */

export interface LoraEntry {
  model: string;
  weight?: number;
}

const WEIGHT_MIN = 0;
const WEIGHT_MAX = 10;

/**
 * Parse a single line "model" or "model:weight".
 * If the part after the last colon is a number in [WEIGHT_MIN, WEIGHT_MAX], it's the weight;
 * otherwise the whole line is the model and weight defaults to 1.
 * Supports civitai:144142@160130 and civitai:144142@160130:0.8
 */
export function parseLoraLine(line: string): LoraEntry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const lastColon = trimmed.lastIndexOf(':');
  if (lastColon === -1) return { model: trimmed, weight: 1 };
  const suffix = trimmed.slice(lastColon + 1).trim();
  const num = parseFloat(suffix);
  const isReasonableWeight =
    suffix !== '' &&
    !Number.isNaN(num) &&
    num >= WEIGHT_MIN &&
    num <= WEIGHT_MAX;
  if (isReasonableWeight) {
    return {
      model: trimmed.slice(0, lastColon).trim(),
      weight: num,
    };
  }
  return { model: trimmed, weight: 1 };
}

/**
 * Parse multiline text into LoraEntry[] (one per non-empty line).
 */
export function parseLoraText(text: string): LoraEntry[] {
  const lines = text.split('\n').map((s) => s.trim()).filter(Boolean);
  return lines.map(parseLoraLine).filter((x): x is LoraEntry => x != null);
}
