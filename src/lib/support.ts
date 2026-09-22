/**
 * What the support line reports, and how it reads.
 *
 * The run state stores the fact, never the sentence: the reducer does not
 * compose copy, so the same run can be described by another surface or in
 * another language without touching the state machine. The tone is derived from
 * the fact as well, which is one field less that could disagree with the text
 * next to it.
 *
 * Two facts carry a sentence of their own — the WebGPU probe's finding and the
 * worker's load phases — because only their source can word them.
 */

export type SupportTone = "info" | "ok" | "error";

/**
 * Keeps a switch over the facts exhaustive: a fact without a case is a compile
 * error at this call rather than a value that quietly falls through.
 */
function unhandled(fact: never): never {
  return fact;
}

import type { ReadoutMode } from "@/lib/readout";

/** What the support line is currently saying. */
export type Support =
  /** No WebGPU probe has answered yet. */
  | { kind: "checking" }
  /** The worker reports a load phase in its own words. */
  | { kind: "progress"; message: string }
  /** A load was requested and is in flight. */
  | { kind: "loading-model" }
  /** The probe answered; its sentence explains what it found. */
  | { kind: "webgpu"; ok: boolean; message: string }
  /** A run started, computing the paths of that readout. */
  | { kind: "running"; cases: number; readout: ReadoutMode }
  /** A model is resident. */
  | { kind: "model-ready"; modelName: string }
  /** The last run finished, having computed the paths of that readout. */
  | { kind: "done"; cases: number; readout: ReadoutMode }
  /** A refusal or a failure, worded by whoever detected it. */
  | { kind: "failed"; message: string };

/** The tone the support line is shown in. */
export function supportTone(support: Support): SupportTone {
  switch (support.kind) {
    case "checking":
    case "progress":
    case "loading-model":
    case "running":
      return "info";
    case "webgpu":
      return support.ok ? "ok" : "error";
    case "model-ready":
    case "done":
      return "ok";
    case "failed":
      return "error";
    default:
      return unhandled(support);
  }
}

/** The sentence the support line shows. */
export function supportText(support: Support): string {
  switch (support.kind) {
    case "checking":
      return "Checking WebGPU…";
    case "progress":
      return support.message;
    case "loading-model":
      return "Loading the model…";
    case "webgpu":
      return support.message;
    case "running":
      // Only a run of one names its paths; a batch would say the same line for
      // every case and never mention what is being computed.
      if (support.cases > 1) return `Running ${support.cases} cases on the loaded model…`;
      switch (support.readout) {
        case "choices":
          return "Running the direct readout…";
        case "json":
          return "Running the token-by-token generation…";
        case "both":
          return "Running the direct readout, then the token-by-token generation…";
      }
    case "model-ready":
      return `Ready. ${support.modelName} is loaded locally on WebGPU.`;
    case "done":
      if (support.cases > 1) {
        return `${support.cases} cases complete. Edit the cases and run again whenever you like.`;
      }
      // Named after the paths that ran, the same way the lanes above name them.
      switch (support.readout) {
        case "choices":
          return "Direct readout complete. Edit the decision and run again whenever you like.";
        case "json":
          return "Generation complete. Edit the decision and run again whenever you like.";
        case "both":
          return "Comparison complete. Edit the decision and run again whenever you like.";
      }
    case "failed":
      return support.message;
    default:
      return unhandled(support);
  }
}
