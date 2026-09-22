/**
 * The run state machine, as one pure reducer.
 *
 * It decides what the page shows about a load or a run; the hook around it only
 * owns the worker and the message plumbing. Keeping the transitions here means
 * they can be exercised without React, a worker or a GPU.
 *
 * This module is app-side: it describes the result of the WebGPU probe, which
 * only the document performs. The worker-facing pieces live in
 * `src/lib/inference/`.
 */

import type { Case, CaseOutcome } from "@/lib/cases";
import type { DownloadSnapshot } from "@/lib/download";
import type {
  DirectResult,
  GenerationResult,
  GenerationUpdate,
  WorkerEvent,
} from "@/lib/inference/protocol";
import type { ModelId } from "@/lib/models";
import type { ReadoutMode } from "@/lib/readout";
import type { WebGPUStatus } from "@/lib/webgpu";

export type SupportTone = "info" | "ok" | "error";

/** The list a run is working through, and what it has produced so far. */
export interface BatchState {
  ids: string[];
  outcomes: CaseOutcome[];
  /** The case being computed, or null while the batch is idle. */
  runningId: string | null;
}

export interface RunState {
  webgpuChecked: boolean;
  webgpuOk: boolean;
  modelReady: boolean;
  busy: "load" | "run" | null;
  support: { text: string; tone: SupportTone };
  download: DownloadSnapshot;
  loadMs: number | null;
  warmupMs: number | null;
  /** The tier whose weights are resident, or null while nothing is loaded. */
  loadedModelId: ModelId | null;
  direct: DirectResult | null;
  stream: GenerationUpdate | null;
  /** The generation result, or null when the run did not ask for one. */
  result: GenerationResult | null;
  /** The running or last run, one entry per case, or null before the first run. */
  batch: BatchState | null;
}

/** The list the worker listener is walking through. */
export interface RunQueue {
  cases: Case[];
  readout: ReadoutMode;
  index: number;
  /** The direct result of the case in flight, which arrives before `complete`. */
  direct: DirectResult | null;
}

/**
 * Closes the case in flight and names the one that follows.
 *
 * The worker is only told about a case once the previous one completed, so the
 * two never run against the engine at the same time; the caller sends `next`
 * and keeps the queue as one pure step.
 */
export function finishCase(
  queue: RunQueue,
  generation: GenerationResult | null,
): { outcome: CaseOutcome; next: Case | null } {
  return {
    outcome: {
      id: queue.cases[queue.index].id,
      direct: queue.direct,
      generation,
    },
    next: queue.index + 1 < queue.cases.length ? queue.cases[queue.index + 1] : null,
  };
}

export const initialRunState: RunState = {
  webgpuChecked: false,
  webgpuOk: false,
  modelReady: false,
  busy: null,
  support: { text: "Checking WebGPU…", tone: "info" },
  download: { percent: null, value: "—", detail: "starts only when you click load" },
  loadMs: null,
  warmupMs: null,
  loadedModelId: null,
  direct: null,
  stream: null,
  result: null,
  batch: null,
};

export type RunAction =
  | { type: "webgpu-checked"; status: WebGPUStatus }
  | { type: "support"; text: string; tone: SupportTone }
  | { type: "start-load" }
  | { type: "start-batch"; ids: string[] }
  | { type: "case-done"; outcome: CaseOutcome }
  | { type: "reset-run" }
  | { type: "download"; snapshot: DownloadSnapshot }
  | { type: "worker-event"; event: WorkerEvent };

/** Says what finished, in the words the single-decision lab used before. */
function doneMessage(outcomes: CaseOutcome[]): string {
  if (outcomes.length > 1) {
    return `${outcomes.length} cases complete. Edit the cases and run again whenever you like.`;
  }
  return outcomes[0].generation
    ? "Comparison complete. Edit the decision and run again whenever you like."
    : "Direct readout complete. Edit the decision and run again whenever you like.";
}

function applyWorkerEvent(state: RunState, event: WorkerEvent): RunState {
  switch (event.type) {
    case "loading":
      return { ...state, support: { text: event.message, tone: "info" } };

    case "loaded":
      return { ...state, loadMs: event.loadMs, download: { ...state.download, percent: 100 } };

    case "ready":
      return {
        ...state,
        modelReady: true,
        busy: null,
        warmupMs: event.warmupMs,
        loadedModelId: event.modelId,
        support: {
          text: `Ready. ${event.modelName} is loaded locally on WebGPU.`,
          tone: "ok",
        },
      };

    case "direct":
      return { ...state, direct: event };

    case "generation-start":
      return { ...state, stream: { text: "", tokens: 0, ttftMs: null } };

    case "generation-update":
      return {
        ...state,
        stream: { text: event.text, tokens: event.tokens, ttftMs: event.ttftMs },
      };

    case "complete":
      // The run is finished by the batch bookkeeping, not here: every run is a
      // list of cases, and a single run is a list of one.
      return { ...state, result: event.generation };

    case "error":
      return {
        ...state,
        busy: null,
        batch: state.batch ? { ...state.batch, runningId: null } : null,
        support: { text: event.message, tone: "error" },
      };

    default:
      return state;
  }
}

export function runStateReducer(state: RunState, action: RunAction): RunState {
  switch (action.type) {
    case "webgpu-checked":
      return {
        ...state,
        webgpuChecked: true,
        webgpuOk: action.status.ok,
        support: { text: action.status.message, tone: action.status.ok ? "ok" : "error" },
      };

    case "support":
      return { ...state, support: { text: action.text, tone: action.tone } };

    case "start-load":
      return {
        ...state,
        busy: "load",
        // A switch starts by discarding the resident tier: its readouts would
        // otherwise be attributed to the model that replaces it.
        modelReady: false,
        loadedModelId: null,
        loadMs: null,
        warmupMs: null,
        direct: null,
        stream: null,
        result: null,
        batch: null,
        support: { text: "Loading the model…", tone: "info" },
      };

    case "start-batch":
      return {
        ...state,
        busy: "run",
        direct: null,
        stream: null,
        result: null,
        batch: { ids: action.ids, outcomes: [], runningId: action.ids[0] ?? null },
        support: {
          text:
            action.ids.length === 1
              ? "Running the direct readout, then the token-by-token generation…"
              : `Running ${action.ids.length} cases on the loaded model…`,
          tone: "info",
        },
      };

    case "case-done": {
      const current = state.batch;
      if (!current) return state;
      const outcomes = [...current.outcomes, action.outcome];
      const finished = outcomes.length >= current.ids.length;
      return {
        ...state,
        batch: {
          ...current,
          outcomes,
          runningId: finished ? null : current.ids[outcomes.length],
        },
        // While the batch advances, the single-run readouts would describe the
        // case that just ended, so they are dropped: each case starts empty.
        direct: finished ? state.direct : null,
        stream: finished ? state.stream : null,
        result: finished ? state.result : null,
        // The batch stays busy until its last case is done.
        busy: finished ? null : state.busy,
        support: finished ? { text: doneMessage(outcomes), tone: "ok" } : state.support,
      };
    }

    case "reset-run":
      // The readouts described the previous input; a new input has none.
      return { ...state, direct: null, stream: null, result: null, batch: null };

    case "download":
      return { ...state, download: action.snapshot };

    case "worker-event":
      return applyWorkerEvent(state, action.event);

    default:
      return state;
  }
}
