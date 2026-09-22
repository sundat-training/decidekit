/**
 * Owns the inference worker and turns its messages into run state.
 *
 * The state machine itself lives in `src/lib/runState.ts`; what stays here is
 * the imperative part — creating the worker, walking a case list one case at a
 * time, and the callbacks the pages call.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import type { Case } from "@/lib/cases";
import { validateDecisionInput, type DecisionInput } from "@/lib/decision";
import { DownloadTracker } from "@/lib/download";
import type { GenerationResult, WorkerEvent, WorkerRequest } from "@/lib/inference/protocol";
import { isModelId, type ModelId } from "@/lib/models";
import type { ReadoutMode } from "@/lib/readout";
import {
  finishCase,
  initialRunState,
  runStateReducer,
  type RunQueue,
  type RunState,
} from "@/lib/runState";
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

export interface UseInferenceOptions {
  createWorker?: WorkerFactory;
  probe?: WebGPUProbe;
}

export interface InferenceApi extends RunState {
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
  /** Drops the previous run's readouts, for when the input itself changes. */
  resetRun: () => void;
}

const defaultWorkerFactory: WorkerFactory = () =>
  new Worker(new URL("../worker/inference.worker.ts", import.meta.url), { type: "module" });

export function useInference(options: UseInferenceOptions = {}): InferenceApi {
  const { createWorker = defaultWorkerFactory, probe = probeWebGPU } = options;
  const [state, dispatch] = useReducer(runStateReducer, initialRunState);
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

      const { outcome, next } = finishCase(queue, generation);
      queue.index += 1;
      queue.direct = null;
      dispatch({ type: "case-done", outcome });

      if (!next) {
        queueRef.current = null;
        return;
      }
      workerRef.current?.postMessage({ type: "compare", data: next.input, readout: queue.readout });
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
      dispatch({ type: "worker-failed", message: `Worker failed: ${event.message}` });
    });
    workerRef.current = worker;
    return worker;
  }, []);

  const loadModel = useCallback(
    (modelId: ModelId, useLocal: boolean) => {
      if (!isModelId(modelId)) {
        dispatch({ type: "fail", message: "Choose one of the listed models." });
        return;
      }
      queueRef.current = null;
      trackerRef.current.reset();
      dispatch({ type: "download", snapshot: trackerRef.current.current });
      dispatch({ type: "start-load", modelId });
      ensureWorker().postMessage({ type: "load", modelId, useLocal });
    },
    [ensureWorker],
  );

  const startBatch = useCallback(
    (cases: Case[], readout: ReadoutMode): boolean => {
      if (cases.length === 0) {
        dispatch({ type: "fail", message: "Load at least one case." });
        return false;
      }
      for (const item of cases) {
        const problem = validateDecisionInput(item.input);
        if (problem) {
          // A batch says which case is unusable; a single run keeps its message.
          const prefix = cases.length > 1 ? `${item.id}: ` : "";
          dispatch({ type: "fail", message: `${prefix}${problem}` });
          return false;
        }
      }
      queueRef.current = { cases, readout, index: 0, direct: null };
      dispatch({ type: "start-batch", ids: cases.map((item) => item.id), readout });
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

  const resetRun = useCallback(() => {
    queueRef.current = null;
    dispatch({ type: "reset-run" });
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
    resetRun,
  };
}
