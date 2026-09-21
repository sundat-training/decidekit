import { useCallback, useEffect, useReducer, useRef } from "react";

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

export interface ComparisonResult extends GenerationResult {
  directMs: number;
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
  readyModelName: string | null;
  direct: DirectResult | null;
  stream: GenerationUpdate | null;
  result: ComparisonResult | null;
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
  readyModelName: null,
  direct: null,
  stream: null,
  result: null,
};

type Action =
  | { type: "webgpu-checked"; status: WebGPUStatus }
  | { type: "support"; text: string; tone: SupportTone }
  | { type: "start-load" }
  | { type: "start-run" }
  | { type: "download"; snapshot: DownloadSnapshot }
  | { type: "worker-event"; event: WorkerEvent };

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
      return { ...state, busy: "load", support: { text: "Loading the model…", tone: "info" } };

    case "start-run":
      return {
        ...state,
        busy: "run",
        direct: null,
        stream: null,
        result: null,
        support: {
          text: "Running the direct readout, then the token-by-token generation…",
          tone: "info",
        },
      };

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
        readyModelName: event.modelName,
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
      return {
        ...state,
        busy: null,
        result: event,
        support: {
          text: "Comparison complete. Edit the decision and run again whenever you like.",
          tone: "ok",
        },
      };

    case "error":
      return {
        ...state,
        busy: null,
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
  /** A load may start once WebGPU is confirmed and no model is ready yet. */
  canLoad: boolean;
  /** Both paths need a loaded model and no run in flight. */
  canRun: boolean;
  isModelReady: boolean;
  loadModel: (modelId: ModelId, useLocal: boolean) => void;
  runComparison: (input: DecisionInput) => boolean;
  reportSupport: (text: string, tone: SupportTone) => void;
}

const defaultWorkerFactory: WorkerFactory = () =>
  new Worker(new URL("../worker/inference.worker.ts", import.meta.url), { type: "module" });

export function useInference(options: UseInferenceOptions = {}): InferenceApi {
  const { createWorker = defaultWorkerFactory, probe = probeWebGPU } = options;
  const [state, dispatch] = useReducer(reducer, initialState);

  const workerRef = useRef<WorkerLike | null>(null);
  const trackerRef = useRef(new DownloadTracker());
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
      dispatch({ type: "worker-event", event: message });
    });
    worker.addEventListener("error", (event) => {
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
      trackerRef.current.reset();
      dispatch({ type: "download", snapshot: trackerRef.current.current });
      dispatch({ type: "start-load" });
      ensureWorker().postMessage({ type: "load", modelId, useLocal });
    },
    [ensureWorker],
  );

  const runComparison = useCallback(
    (input: DecisionInput): boolean => {
      const problem = validateDecisionInput(input);
      if (problem) {
        dispatch({ type: "support", text: problem, tone: "error" });
        return false;
      }
      dispatch({ type: "start-run" });
      ensureWorker().postMessage({ type: "compare", data: input });
      return true;
    },
    [ensureWorker],
  );

  const reportSupport = useCallback((text: string, tone: SupportTone) => {
    dispatch({ type: "support", text, tone });
  }, []);

  const canLoad = state.webgpuOk && !state.modelReady && state.busy === null;
  const canRun = state.modelReady && state.busy === null;

  return {
    ...state,
    canLoad,
    canRun,
    isModelReady: state.modelReady,
    loadModel,
    runComparison,
    reportSupport,
  };
}
