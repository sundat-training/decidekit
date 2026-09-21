/**
 * The line under the results. It has to hold up in three modes, and it must not
 * imply a comparison that was never measured — a single readout has no ratio.
 */

import { formatSeconds } from "@/lib/format";
import type { ReadoutMode } from "@/lib/readout";

export interface VerdictInput {
  readout: ReadoutMode;
  /** Wall time of the direct readout, or null when it did not run. */
  directMs: number | null;
  /** Wall time of the generation, or null when it did not run. */
  generationMs: number | null;
  generatedTokens: number | null;
}

export interface Verdict {
  label: string;
  ratio: string;
  note: string;
}

export const VERDICT_IDLE_RATIO = "run it on your GPU";

export function describeVerdict({
  readout,
  directMs,
  generationMs,
  generatedTokens,
}: VerdictInput): Verdict {
  if (readout === "choices") {
    return directMs === null
      ? {
          label: "measured wall time",
          ratio: VERDICT_IDLE_RATIO,
          note: "One constrained forward pass on the loaded model, with no tokens to decode.",
        }
      : {
          label: "measured wall time",
          ratio: `direct · ${formatSeconds(directMs)}`,
          note: "Only the direct readout ran. One forward pass, no decoding, so this is not comparable to a generation.",
        };
  }

  if (readout === "json") {
    return generationMs === null
      ? {
          label: "measured wall time",
          ratio: VERDICT_IDLE_RATIO,
          note: "The model writes the distribution token by token. The direct readout is skipped.",
        }
      : {
          label: "measured wall time",
          ratio: `json · ${formatSeconds(generationMs)}`,
          note: `Only the generation ran. ${generatedTokens ?? 0} tokens decoded, so there is no second readout to compare against.`,
        };
  }

  if (directMs === null || generationMs === null) {
    return {
      label: "measured wall-time ratio",
      ratio: VERDICT_IDLE_RATIO,
      note: "The methods run sequentially on the same loaded model so they never contend for one GPU. Direct runs first, then generation.",
    };
  }

  return {
    label: "measured wall-time ratio",
    ratio: `${(generationMs / directMs).toFixed(2)}× generation / direct`,
    note: `Measured sequentially in this tab. Direct: ${formatSeconds(directMs)}. Generation: ${formatSeconds(generationMs)}. The order is fixed and the model was warmed before both.`,
  };
}
