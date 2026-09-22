/** Wall-clock milliseconds rendered the way the metrics panels show them. */
export function formatSeconds(milliseconds: number): string {
  return `${(milliseconds / 1000).toFixed(3)} s`;
}

/** Counts that read naturally in both singular and plural. */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * The generation-to-direct wall-time ratio, e.g. `6.00×`, or null when a time
 * is missing or the direct pass was too short to divide by.
 *
 * The verdict bar and the case table both print this value through here, so the
 * two can never round, guard or label it differently.
 */
export function formatRatio(directMs: number | null, generationMs: number | null): string | null {
  if (directMs === null || generationMs === null) return null;
  const ratio = generationMs / directMs;
  return Number.isFinite(ratio) ? `${ratio.toFixed(2)}×` : null;
}
