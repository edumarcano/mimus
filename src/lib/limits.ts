export const MAX_INPUT_CODE_POINTS = 3000;
export const MAX_BODY_BYTES = 16384;
export const MAX_OUTPUT_CODE_POINTS = 8000;
export const REQUEST_DEADLINE_MS = 45000;

/** Count Unicode code points (same algorithm in browser and server). */
export function countCodePoints(text: string): number {
  return Array.from(text).length;
}
