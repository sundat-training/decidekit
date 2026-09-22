/**
 * The line under the results: what the number is, and what it measured. The
 * interpretation of those numbers lives on the about page, so this stays a
 * label and a value.
 */

import { formatSeconds } from "@/lib/format";
import type { ReadoutMode } from "@/lib/readout";

export interface VerdictInput {
  readout: ReadoutMode;
  /** Wall time of the direct readout, or null when it did not run. */
  directMs: number | null;
  /** Wall time of the generation, or null when it did not run. */
  generationMs: number | null;
}

export interface Verdict {
  label: string;
  ratio: string;
}

export const VERDICT_IDLE_RATIO = "run it on your GPU";

export function describeVerdict({ readout, directMs, generationMs }: VerdictInput): Verdict {
  if (readout === "choices") {
    return {
      label: "measured wall time",
      ratio: directMs === null ? VERDICT_IDLE_RATIO : `direct · ${formatSeconds(directMs)}`,
    };
  }

  if (readout === "json") {
    return {
      label: "measured wall time",
      ratio: generationMs === null ? VERDICT_IDLE_RATIO : `json · ${formatSeconds(generationMs)}`,
    };
  }

  return {
    label: "measured wall-time ratio",
    ratio:
      directMs === null || generationMs === null
        ? VERDICT_IDLE_RATIO
        : `${(generationMs / directMs).toFixed(2)}× generation / direct`,
  };
}
