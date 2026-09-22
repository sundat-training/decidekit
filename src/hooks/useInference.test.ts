import { describe, expect, it, vi } from "vitest";
import { renderHook } from "vitest-browser-react";

import { useInference } from "@/hooks/useInference";
import type { Case } from "@/lib/cases";
import type { WorkerEvent } from "@/lib/inference/protocol";
import { FakeWorker } from "../../test/fakeWorker";

const READY = async () => ({ ok: true, message: "WebGPU is ready." });

const FIRST: Case = {
  id: "first",
  type: "decision",
  input: { state: "A state", question: "A question?", options: ["One", "Two"] },
};

const SECOND: Case = {
  id: "second",
  type: "decision",
  input: {
    state: "Another state",
    question: "Another question?",
    options: ["One", "Two", "Three"],
  },
};

function direct(label: string, probability: number) {
  return {
    type: "direct" as const,
    totalMs: 900,
    inputTokens: 10,
    readouts: 1,
    options: [{ label, description: `${label} option`, probability, logit: -0.1 }],
  };
}

const READY_EVENT: WorkerEvent = {
  type: "ready",
  warmupMs: 88,
  modelId: "minicpm5-2b",
  modelName: "MiniCPM5 2B",
};

/**
 * Worker events arrive outside React's event handlers. The state update they
 * trigger is picked up by the retrying assertions below, so no manual act()
 * wrapper is needed — vitest-browser-react manages React's act environment.
 */
async function setup() {
  const worker = new FakeWorker();
  const { result } = await renderHook(() =>
    useInference({ createWorker: () => worker.asWorkerLike(), probe: READY }),
  );
  await vi.waitFor(() => expect(result.current.webgpuOk).toBe(true));

  result.current.loadModel("minicpm5-2b", false);
  await vi.waitFor(() => expect(worker.requests).toHaveLength(1));
  worker.emit(READY_EVENT);
  await vi.waitFor(() => expect(result.current.canRun).toBe(true));

  return { worker, result };
}

describe("case batches", () => {
  it("runs the cases one after the other", async () => {
    const { worker, result } = await setup();

    result.current.runCases([FIRST, SECOND], "choices");

    await vi.waitFor(() => expect(result.current.batch?.runningId).toBe("first"));
    expect(result.current.batch?.ids).toEqual(["first", "second"]);
    expect(worker.compares()).toEqual([{ type: "compare", data: FIRST.input, readout: "choices" }]);

    worker.emit(direct("A", 0.7));
    await vi.waitFor(() => expect(result.current.direct?.options[0].label).toBe("A"));

    worker.emit({ type: "complete", generation: null });

    // The first outcome is in, the second case is sent, and the readouts of the
    // finished case are gone rather than lingering into the next one.
    await vi.waitFor(() =>
      expect(result.current.batch?.outcomes.map((outcome) => outcome.id)).toEqual(["first"]),
    );
    expect(result.current.direct).toBeNull();
    expect(result.current.stream).toBeNull();
    expect(result.current.batch?.runningId).toBe("second");
    expect(worker.compares().at(-1)).toEqual({
      type: "compare",
      data: SECOND.input,
      readout: "choices",
    });

    worker.emit(direct("B", 0.8));
    worker.emit({ type: "complete", generation: null });

    await vi.waitFor(() =>
      expect(result.current.batch?.outcomes.map((outcome) => outcome.id)).toEqual([
        "first",
        "second",
      ]),
    );
    await vi.waitFor(() => expect(result.current.busy).toBeNull());
    expect(result.current.batch?.runningId).toBeNull();
    expect(worker.compares()).toHaveLength(2);
  });

  it("refuses a batch with an unusable case before sending anything", async () => {
    const { worker, result } = await setup();
    const broken: Case = { ...SECOND, id: "broken", input: { ...SECOND.input, state: "" } };

    result.current.runCases([FIRST, broken], "choices");

    // A batch names the case; the single-decision run keeps the bare message.
    await vi.waitFor(() =>
      expect(result.current.support).toEqual({
        kind: "failed",
        message: "broken: State, question and every option must be nonempty.",
      }),
    );
    expect(worker.compares()).toHaveLength(0);
    expect(result.current.busy).toBeNull();
  });

  it("does not advance the queue after an error", async () => {
    const { worker, result } = await setup();

    result.current.runCases([FIRST, SECOND], "choices");
    await vi.waitFor(() => expect(result.current.batch?.runningId).toBe("first"));

    worker.emit({ type: "error", message: "No GPU adapter." });
    await vi.waitFor(() => expect(result.current.busy).toBeNull());

    // A late completion for the failed case must not start the next one.
    worker.emit({ type: "complete", generation: null });
    expect(worker.compares()).toHaveLength(1);
  });

  it("keeps the table's inputs identical while a generation streams", async () => {
    const { worker, result } = await setup();

    result.current.runCases([FIRST, SECOND], "json");
    await vi.waitFor(() => expect(result.current.batch?.runningId).toBe("first"));

    const batch = result.current.batch;
    const outcomes = batch?.outcomes;

    worker.emit({ type: "generation-start" });
    worker.emit({ type: "generation-update", text: "{", tokens: 1, ttftMs: 40 });
    await vi.waitFor(() => expect(result.current.stream?.text).toBe("{"));

    // The table reads these through a shallow comparison, so a stream update
    // must not replace them: that is what keeps it out of the token loop.
    expect(result.current.batch).toBe(batch);
    expect(result.current.batch?.outcomes).toBe(outcomes);
  });

  it("drops every readout when the input changes", async () => {
    const { worker, result } = await setup();

    result.current.runCases([FIRST], "choices");
    worker.emit(direct("A", 0.7));
    worker.emit({ type: "complete", generation: null });
    await vi.waitFor(() => expect(result.current.batch?.outcomes).toHaveLength(1));

    result.current.resetRun();

    await vi.waitFor(() => expect(result.current.batch).toBeNull());
    expect(result.current.direct).toBeNull();
    expect(result.current.stream).toBeNull();
    expect(result.current.result).toBeNull();
  });
});
