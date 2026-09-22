/**
 * What the lab reports about a finished run, beyond the raw lanes.
 *
 * Two derived statements live here: how much slower the generation is than the
 * direct readout, and whether the generation could be read at all.
 */

import { formatRatio } from "@/lib/format";
import type { GenerationResult } from "@/lib/inference/protocol";
import { isComparison, type ReadoutMode } from "@/lib/readout";

export interface VerdictInput {
  readout: ReadoutMode;
  /** Wall time of the direct readout, or null when it did not run. */
  directMs: number | null;
  /** Wall time of the generation, or null when it did not run. */
  generationMs: number | null;
}

export const VERDICT_IDLE_RATIO = "run it on your GPU";

/** A finished generation, reduced to the tone and the one line it is shown as. */
export interface ValidationLine {
  tone: "ok" | "error";
  text: string;
}

/**
 * `6.00× generation / direct`, or null when the mode has nothing to compare.
 *
 * A single path has nothing to compare, and the lane already shows its own wall
 * time, so this returns null rather than repeating that value in the bar below.
 */
export function verdictRatio({ readout, directMs, generationMs }: VerdictInput): string | null {
  if (!isComparison(readout)) return null;
  const ratio = formatRatio(directMs, generationMs);
  return ratio === null ? VERDICT_IDLE_RATIO : `${ratio} generation / direct`;
}

/** Whether the generation parsed, and what it produced if it did. */
export function validationLine(result: GenerationResult): ValidationLine {
  if (result.valid) {
    const unwrapped = result.strippedFence ? " · code fence stripped" : "";
    return { tone: "ok", text: `valid JSON${unwrapped} · top choice ${result.choice}` };
  }
  return { tone: "error", text: `unusable output · ${result.validationError}` };
}
