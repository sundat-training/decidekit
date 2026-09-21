/** Wall-clock milliseconds rendered the way the metrics panels show them. */
export function formatSeconds(milliseconds: number): string {
  return `${(milliseconds / 1000).toFixed(3)} s`;
}

/** Counts that read naturally in both singular and plural. */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
