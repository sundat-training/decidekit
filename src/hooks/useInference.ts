import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import type { Case, CaseOutcome } from "@/lib/cases";
import { validateDecisionInput, type DecisionInput } from "@/lib/decision";
import { DownloadTracker, type DownloadSnapshot } from "@/lib/download";
import type {
  DirectResult,
  GenerationResult,
  GenerationUpdate,
  WorkerEvent,
  WorkerRequest,
} from "@/lib/inference/protocol";
import { isModelId, type ModelId } from "@/lib/models";
import type { ReadoutMode } from "@/lib/readout";
import { readCachedTiers, rememberTier } from "@/lib/tierCache";
import { probeWebGPU, type WebGPUStatus } from "@/lib/webgpu";

/** The part of `Worker` this hook uses, so tests can inject a stub. */
export interface WorkerLike {
  postMessage(message: WorkerRequest): void;
  addEventListener(type: "message", listener: (event: MessageEvent<WorkerEvent>) => void): void;
  addEventListener(type: "error", listener: (event: ErrorEvent) => void): void;
  terminate(): void;
}

export type WorkerFactory = () => WorkerLike;
export type WebGPUProbe = () => Promise<WebGPUStatus>;

export type SupportTone = "info" | "ok" | "error";

/** The list a run is working through, and what it has produced so far. */
export interface BatchState {
  ids: string[];
  outcomes: CaseOutcome[];
  /** The case being computed, or null while the batch is idle. */
  runningId: string | null;
}

export interface InferenceState {
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

const initialState: InferenceState = {
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

type Action =
  | { type: "webgpu-checked"; status: WebGPUStatus }
  | { type: "support"; text: string; tone: SupportTone }
  | { type: "start-load" }
  | { type: "start-batch"; ids: string[] }
  | { type: "case-done"; outcome: CaseOutcome }
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

function reducer(state: InferenceState, action: Action): InferenceState {
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
        // The batch stays busy until its last case is done.
        busy: finished ? null : state.busy,
        support: finished ? { text: doneMessage(outcomes), tone: "ok" } : state.support,
      };
    }

    case "download":
      return { ...state, download: action.snapshot };

    case "worker-event":
      return applyWorkerEvent(state, action.event);

    default:
      return state;
  }
}

function applyWorkerEvent(state: InferenceState, event: WorkerEvent): InferenceState {
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

export interface UseInferenceOptions {
  createWorker?: WorkerFactory;
  probe?: WebGPUProbe;
}

export interface InferenceApi extends InferenceState {
  /** A load or a switch may start once WebGPU is confirmed and nothing is busy. */
  canLoad: boolean;
  /** Both paths need a loaded model and no run in flight. */
  canRun: boolean;
  /** Tiers this browser has loaded before, so a switch should skip the download. */
  cachedTiers: ModelId[];
  loadModel: (modelId: ModelId, useLocal: boolean) => void;
  /** Runs one decision, which is a batch of one under the hood. */
  runComparison: (input: DecisionInput, readout: ReadoutMode) => boolean;
  /** Runs every case in order on the loaded model. */
  runCases: (cases: Case[], readout: ReadoutMode) => boolean;
  reportSupport: (text: string, tone: SupportTone) => void;
}

/** The list the worker listener is walking through. */
interface RunQueue {
  cases: Case[];
  readout: ReadoutMode;
  index: number;
  /** The direct result of the case in flight, which arrives before `complete`. */
  direct: DirectResult | null;
}

const defaultWorkerFactory: WorkerFactory = () =>
  new Worker(new URL("../worker/inference.worker.ts", import.meta.url), { type: "module" });

export function useInference(options: UseInferenceOptions = {}): InferenceApi {
  const { createWorker = defaultWorkerFactory, probe = probeWebGPU } = options;
  const [state, dispatch] = useReducer(reducer, initialState);
  const [cachedTiers, setCachedTiers] = useState<ModelId[]>(readCachedTiers);

  const workerRef = useRef<WorkerLike | null>(null);
  const trackerRef = useRef(new DownloadTracker());
  const queueRef = useRef<RunQueue | null>(null);
  const probeRef = useRef(probe);
  const createWorkerRef = useRef(createWorker);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const status = await probeRef.current();
        if (!cancelled) dispatch({ type: "webgpu-checked", status });
      } catch (error) {
        if (cancelled) return;
        dispatch({
          type: "webgpu-checked",
          status: {
            ok: false,
            message: `WebGPU check failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        });
      }
    };

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  const ensureWorker = useCallback((): WorkerLike => {
    if (workerRef.current) return workerRef.current;

    /**
     * Records the case that just finished and starts the next one. The worker
     * is only told about a case once the previous one completed, so the two
     * never run against the engine at the same time.
     */
    const advanceQueue = (generation: GenerationResult | null): void => {
      const queue = queueRef.current;
      if (!queue) return;

      const outcome: CaseOutcome = {
        id: queue.cases[queue.index].id,
        direct: queue.direct,
        generation,
      };
      queue.index += 1;
      queue.direct = null;
      dispatch({ type: "case-done", outcome });

      if (queue.index >= queue.cases.length) {
        queueRef.current = null;
        return;
      }
      workerRef.current?.postMessage({
        type: "compare",
        data: queue.cases[queue.index].input,
        readout: queue.readout,
      });
    };

    const worker = createWorkerRef.current();
    worker.addEventListener("message", (event) => {
      const message = event.data;
      if (message.type === "progress") {
        dispatch({ type: "download", snapshot: trackerRef.current.update(message.event) });
        return;
      }
      if (message.type === "loaded" || message.type === "ready") {
        dispatch({ type: "download", snapshot: trackerRef.current.markComplete() });
        if (message.type === "loaded" && !trackerRef.current.observedTransfer) {
          dispatch({ type: "download", snapshot: trackerRef.current.markCached() });
        }
      }
      if (message.type === "ready") setCachedTiers(rememberTier(message.modelId));

      if (message.type === "direct" && queueRef.current) {
        queueRef.current.direct = message;
      }

      dispatch({ type: "worker-event", event: message });

      // An error ends the run, so the queue must not be advanced afterwards.
      if (message.type === "complete") advanceQueue(message.generation);
      if (message.type === "error") queueRef.current = null;
    });
    worker.addEventListener("error", (event) => {
      queueRef.current = null;
      dispatch({ type: "support", text: `Worker failed: ${event.message}`, tone: "error" });
    });
    workerRef.current = worker;
    return worker;
  }, []);

  const loadModel = useCallback(
    (modelId: ModelId, useLocal: boolean) => {
      if (!isModelId(modelId)) {
        dispatch({ type: "support", text: "Choose one of the listed models.", tone: "error" });
        return;
      }
      queueRef.current = null;
      trackerRef.current.reset();
      dispatch({ type: "download", snapshot: trackerRef.current.current });
      dispatch({ type: "start-load" });
      ensureWorker().postMessage({ type: "load", modelId, useLocal });
    },
    [ensureWorker],
  );

  const startBatch = useCallback(
    (cases: Case[], readout: ReadoutMode): boolean => {
      if (cases.length === 0) {
        dispatch({ type: "support", text: "Load at least one case.", tone: "error" });
        return false;
      }
      for (const item of cases) {
        const problem = validateDecisionInput(item.input);
        if (problem) {
          // A batch says which case is unusable; a single run keeps its message.
          const prefix = cases.length > 1 ? `${item.id}: ` : "";
          dispatch({ type: "support", text: `${prefix}${problem}`, tone: "error" });
          return false;
        }
      }
      queueRef.current = { cases, readout, index: 0, direct: null };
      dispatch({ type: "start-batch", ids: cases.map((item) => item.id) });
      ensureWorker().postMessage({ type: "compare", data: cases[0].input, readout });
      return true;
    },
    [ensureWorker],
  );

  const runComparison = useCallback(
    (input: DecisionInput, readout: ReadoutMode): boolean =>
      startBatch([{ id: "decision", type: "decision", input }], readout),
    [startBatch],
  );

  const runCases = useCallback(
    (cases: Case[], readout: ReadoutMode): boolean => startBatch(cases, readout),
    [startBatch],
  );

  const reportSupport = useCallback((text: string, tone: SupportTone) => {
    dispatch({ type: "support", text, tone });
  }, []);

  const canLoad = state.webgpuOk && state.busy === null;
  const canRun = state.modelReady && state.busy === null;

  return {
    ...state,
    canLoad,
    canRun,
    cachedTiers,
    loadModel,
    runComparison,
    runCases,
    reportSupport,
  };
}
