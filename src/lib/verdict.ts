/**
 * The one derived number the lab reports: how much slower the generation is than
 * the direct readout.
 *
 * A single path has nothing to compare, and the lane already shows its own wall
 * time, so this returns null rather than repeating that value in the bar below.
 */

import type { ReadoutMode } from "@/lib/readout";

export interface VerdictInput {
  readout: ReadoutMode;
  /** Wall time of the direct readout, or null when it did not run. */
  directMs: number | null;
  /** Wall time of the generation, or null when it did not run. */
  generationMs: number | null;
}

export const VERDICT_IDLE_RATIO = "run it on your GPU";

/** `6.00× generation / direct`, or null when the mode has nothing to compare. */
export function verdictRatio({ readout, directMs, generationMs }: VerdictInput): string | null {
  if (readout !== "both") return null;
  if (directMs === null || generationMs === null) return VERDICT_IDLE_RATIO;
  return `${(generationMs / directMs).toFixed(2)}× generation / direct`;
}
