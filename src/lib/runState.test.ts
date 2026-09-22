import { describe, expect, it } from "vitest";

import type { Case, CaseOutcome } from "@/lib/cases";
import type { DirectResult, GenerationResult } from "@/lib/inference/protocol";
import type { ReadoutMode } from "@/lib/readout";
import { finishCase, initialRunState, runStateReducer, type RunState } from "@/lib/runState";

const DIRECT: DirectResult = {
  totalMs: 900,
  inputTokens: 120,
  readouts: 1,
  options: [{ label: "A", description: "Account access support", probability: 0.7, logit: -0.1 }],
};

const GENERATION: GenerationResult = {
  generationMs: 5400,
  inputTokens: 120,
  ttftMs: 300,
  generatedTokens: 30,
  generatedText: "{}",
  valid: true,
  choice: "A",
  choiceDescription: "Account access support",
  probabilities: [1],
  validationError: "",
  strippedFence: false,
};

function outcome(id: string, generation: GenerationResult | null = null): CaseOutcome {
  return { id, direct: DIRECT, generation };
}

function decisionCase(id: string): Case {
  return {
    id,
    type: "decision",
    input: { state: "A state", question: "?", options: ["One", "Two"] },
  };
}

/** A batch that has just been opened, so only its first case is in flight. */
function started(ids: string[], readout: ReadoutMode = "choices"): RunState {
  return runStateReducer(initialRunState, { type: "start-batch", ids, readout });
}

/** The same batch after the worker reported both readouts of its first case. */
function inFlight(state: RunState): RunState {
  return runStateReducer(
    runStateReducer(state, { type: "worker-event", event: { type: "direct", ...DIRECT } }),
    { type: "worker-event", event: { type: "complete", generation: GENERATION } },
  );
}

describe("run state", () => {
  it("reports the WebGPU check in the support line", () => {
    const ok = runStateReducer(initialRunState, {
      type: "webgpu-checked",
      status: { ok: true, message: "WebGPU is ready." },
    });
    expect([ok.webgpuChecked, ok.webgpuOk, ok.support]).toEqual([
      true,
      true,
      { kind: "webgpu", ok: true, message: "WebGPU is ready." },
    ]);

    const failed = runStateReducer(initialRunState, {
      type: "webgpu-checked",
      status: { ok: false, message: "No adapter." },
    });
    expect([failed.webgpuOk, failed.support]).toEqual([
      false,
      { kind: "webgpu", ok: false, message: "No adapter." },
    ]);
  });

  it("discards the resident tier when a load starts", () => {
    const resident: RunState = {
      ...initialRunState,
      modelReady: true,
      loadedModelId: "minicpm5-2b",
      loadMs: 1234,
      warmupMs: 88,
      direct: DIRECT,
      result: GENERATION,
      batch: { ids: ["first"], outcomes: [outcome("first")], runningId: null, readout: "choices" },
    };

    const switching = runStateReducer(resident, {
      type: "start-load",
      modelId: "qwen3.5-4b",
    });

    // The readouts would otherwise be attributed to the model that replaces it.
    expect(switching).toMatchObject({
      busy: "load",
      loadingModelId: "qwen3.5-4b",
      failedModelId: null,
      modelReady: false,
      loadedModelId: null,
      loadMs: null,
      warmupMs: null,
      direct: null,
      stream: null,
      result: null,
      batch: null,
    });
  });

  it("blames a failed load on the tier that was on trial", () => {
    const failed = runStateReducer(
      runStateReducer(initialRunState, { type: "start-load", modelId: "qwen3.5-4b" }),
      { type: "worker-event", event: { type: "error", message: "No GPU adapter." } },
    );

    expect(failed.failedModelId).toBe("qwen3.5-4b");
    expect(failed.loadingModelId).toBeNull();
    expect(failed.busy).toBeNull();
    expect(failed.support).toEqual({ kind: "failed", message: "No GPU adapter." });
  });

  it("clears the previous failure when a new load starts", () => {
    const retried = runStateReducer(
      { ...initialRunState, failedModelId: "qwen3.5-4b" },
      { type: "start-load", modelId: "minicpm5-2b" },
    );

    expect(retried.failedModelId).toBeNull();
    expect(retried.loadingModelId).toBe("minicpm5-2b");
  });

  it("does not blame a run failure on any load", () => {
    const failed = runStateReducer(started(["first"]), {
      type: "worker-event",
      event: { type: "error", message: "Engine crashed." },
    });

    expect(failed.failedModelId).toBeNull();
    expect(failed.busy).toBeNull();
  });

  it("ends a load attempt when the worker itself dies", () => {
    const dead = runStateReducer(
      runStateReducer(initialRunState, { type: "start-load", modelId: "qwen3.5-4b" }),
      { type: "worker-failed", message: "Worker failed: crashed" },
    );

    // A plain error message would leave the panel spinning forever.
    expect(dead.busy).toBeNull();
    expect(dead.failedModelId).toBe("qwen3.5-4b");
    expect(dead.support).toEqual({ kind: "failed", message: "Worker failed: crashed" });
  });

  it("opens a batch on its first case and clears the previous readouts", () => {
    const batch = started(["first", "second"]);

    expect(batch.busy).toBe("run");
    expect(batch.batch).toEqual({
      ids: ["first", "second"],
      outcomes: [],
      runningId: "first",
      readout: "choices",
    });
    expect(batch.support).toEqual({ kind: "running", cases: 2, readout: "choices" });
  });

  it("words a single decision as the one-case batch it is", () => {
    expect(started(["decision"], "both").support).toEqual({
      kind: "running",
      cases: 1,
      readout: "both",
    });
  });

  it("advances to the next case and forgets the one that just ended", () => {
    const advanced = runStateReducer(inFlight(started(["first", "second"])), {
      type: "case-done",
      outcome: outcome("first", GENERATION),
    });

    expect(advanced.batch?.outcomes.map((entry) => entry.id)).toEqual(["first"]);
    expect(advanced.batch?.runningId).toBe("second");
    // Each case starts empty: the finished readouts would look like the next
    // case's own answer.
    expect([advanced.direct, advanced.stream, advanced.result]).toEqual([null, null, null]);
    expect(advanced.busy).toBe("run");
  });

  it("keeps the last case's readouts and ends the run", () => {
    const advanced = runStateReducer(inFlight(started(["first"])), {
      type: "case-done",
      outcome: outcome("first", GENERATION),
    });

    expect(advanced.batch?.runningId).toBeNull();
    expect(advanced.busy).toBeNull();
    // The direct result carries its event tag; the numbers are what matter here.
    expect(advanced.direct).toMatchObject(DIRECT);
    expect(advanced.result).toEqual(GENERATION);
    expect(advanced.support).toEqual({ kind: "done", cases: 1, readout: "choices" });
  });

  it("records which readout the finished batch computed", () => {
    const compared = runStateReducer(started(["decision"], "both"), {
      type: "case-done",
      outcome: outcome("decision", GENERATION),
    });
    expect(compared.support).toEqual({ kind: "done", cases: 1, readout: "both" });

    const directOnly = runStateReducer(started(["decision"]), {
      type: "case-done",
      outcome: outcome("decision"),
    });
    expect(directOnly.support).toEqual({ kind: "done", cases: 1, readout: "choices" });
  });

  it("ignores a case that finishes without a batch", () => {
    expect(runStateReducer(initialRunState, { type: "case-done", outcome: outcome("first") })).toBe(
      initialRunState,
    );
  });

  it("stops the batch on an error and keeps what finished", () => {
    const failed = runStateReducer(started(["first", "second"]), {
      type: "worker-event",
      event: { type: "error", message: "No GPU adapter." },
    });

    expect(failed.busy).toBeNull();
    expect(failed.support).toEqual({ kind: "failed", message: "No GPU adapter." });
    expect(failed.batch?.runningId).toBeNull();
    // The list stays, so the progress badge still says how far the run got.
    expect(failed.batch?.ids).toEqual(["first", "second"]);
    // A late `complete` must not advance it either; that guard is the queue's,
    // because the reducer cannot know whether the worker will still speak.
  });

  it("drops every readout when the input changes", () => {
    const after = runStateReducer(inFlight(started(["first"])), { type: "reset-run" });

    expect([after.direct, after.stream, after.result, after.batch]).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  it("marks the tier ready and ends the busy state", () => {
    const ready = runStateReducer(started(["first"]), {
      type: "worker-event",
      event: { type: "ready", warmupMs: 88, modelId: "minicpm5-2b", modelName: "MiniCPM5 2B" },
    });

    expect(ready.modelReady).toBe(true);
    expect(ready.busy).toBeNull();
    expect(ready.loadedModelId).toBe("minicpm5-2b");
    expect(ready.warmupMs).toBe(88);
    expect(ready.support).toEqual({ kind: "model-ready", modelName: "MiniCPM5 2B" });
  });

  it("streams a partial generation into the lane", () => {
    const streaming = runStateReducer(initialRunState, {
      type: "worker-event",
      event: { type: "generation-update", text: "{", tokens: 1, ttftMs: 40 },
    });

    expect(streaming.stream).toEqual({ text: "{", tokens: 1, ttftMs: 40 });
  });
});

describe("closing a case", () => {
  it("turns the case in flight into its outcome and names the next one", () => {
    const cases = [decisionCase("first"), decisionCase("second")];

    const step = finishCase({ cases, readout: "choices", index: 0, direct: DIRECT }, GENERATION);

    expect(step.outcome).toEqual({ id: "first", direct: DIRECT, generation: GENERATION });
    expect(step.next).toBe(cases[1]);
  });

  it("names no next case after the last one", () => {
    const step = finishCase(
      { cases: [decisionCase("only")], readout: "json", index: 0, direct: null },
      null,
    );

    // A run that asked for one path has no generation: the outcome says so.
    expect(step.outcome).toEqual({ id: "only", direct: null, generation: null });
    expect(step.next).toBeNull();
  });
});
