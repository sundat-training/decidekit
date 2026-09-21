/** The option alphabet and its bounds, shared by both readout paths. */

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 20;

/** A, B, C … for up to {@link MAX_OPTIONS} options. */
export function optionLabels(count: number): string[] {
  return Array.from({ length: count }, (_, index) => String.fromCharCode(65 + index));
}
