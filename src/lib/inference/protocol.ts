import type { GenerationVerdict } from "@/lib/decision";
import type { LoaderProgressEvent } from "@/lib/download";
import type { ModelId } from "@/lib/models";

export interface DirectOptionScore {
  label: string;
  description: string;
  probability: number;
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

export interface CompareInput {
  state: string;
  question: string;
  options: string[];
}

/** Messages the page sends into the inference worker. */
export type WorkerRequest =
  | { type: "load"; modelId: ModelId; useLocal: boolean }
  | { type: "compare"; data: CompareInput };

/** Messages the inference worker sends back. */
export type WorkerEvent =
  | { type: "progress"; event: LoaderProgressEvent }
  | { type: "loading"; message: string }
  | { type: "loaded"; loadMs: number }
  | { type: "ready"; warmupMs: number; modelId: ModelId; modelName: string }
  | ({ type: "direct" } & DirectResult)
  | { type: "generation-start" }
  | ({ type: "generation-update" } & GenerationUpdate)
  | ({ type: "complete"; directMs: number } & GenerationResult)
  | { type: "error"; message: string };
