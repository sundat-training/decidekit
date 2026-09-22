import type { DecisionInput, GenerationVerdict } from "@/lib/decision";
import type { LoaderProgressEvent } from "@/lib/download";
import type { ModelId } from "@/lib/models";
import type { ReadoutMode } from "@/lib/readout";

/** One displayed option with the probability a readout gave it. */
export interface ScoredOption {
  label: string;
  description: string;
  probability: number;
}

export interface DirectOptionScore extends ScoredOption {
  logit: number;
}

export interface DirectResult {
  totalMs: number;
  inputTokens: number;
  readouts: number;
  options: DirectOptionScore[];
}

export interface GenerationResult extends GenerationVerdict {
  generationMs: number;
  inputTokens: number;
  ttftMs: number | null;
  generatedTokens: number;
  generatedText: string;
}

export interface GenerationUpdate {
  text: string;
  tokens: number;
  ttftMs: number | null;
}

/** Messages the page sends into the inference worker. */
export type WorkerRequest =
  | { type: "load"; modelId: ModelId; useLocal: boolean }
  | { type: "compare"; data: DecisionInput; readout: ReadoutMode };

/** Messages the inference worker sends back. */
export type WorkerEvent =
  | { type: "progress"; event: LoaderProgressEvent }
  | { type: "loading"; message: string }
  | { type: "loaded"; loadMs: number }
  | { type: "ready"; warmupMs: number; modelId: ModelId; modelName: string }
  | ({ type: "direct" } & DirectResult)
  | { type: "generation-start" }
  | ({ type: "generation-update" } & GenerationUpdate)
  /**
   * The run is over. `generation` is null when only the direct readout was
   * asked for, so the UI can clear its running state either way.
   */
  | { type: "complete"; generation: GenerationResult | null }
  | { type: "error"; message: string };
