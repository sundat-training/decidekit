import { describe, expect, it } from "vitest";

import { supportText, supportTone, type Support } from "@/lib/support";

describe("support tone", () => {
  it("tones a finished fact as ok and a failure as an error", () => {
    expect(supportTone({ kind: "model-ready", modelName: "MiniCPM5 2B" })).toBe("ok");
    expect(supportTone({ kind: "done", cases: 1, readout: "both" })).toBe("ok");
    expect(supportTone({ kind: "failed", message: "No GPU adapter." })).toBe("error");
  });

  it("takes the probe's tone from its own verdict", () => {
    expect(supportTone({ kind: "webgpu", ok: true, message: "ready" })).toBe("ok");
    expect(supportTone({ kind: "webgpu", ok: false, message: "no adapter" })).toBe("error");
  });

  it("tones work in progress as information", () => {
    const inProgress: Support[] = [
      { kind: "checking" },
      { kind: "progress", message: "Fetching the model…" },
      { kind: "loading-model" },
      { kind: "running", cases: 2, readout: "choices" },
    ];

    expect(inProgress.map(supportTone)).toEqual(["info", "info", "info", "info"]);
  });
});

describe("support text", () => {
  it("words the states that carry no parameter", () => {
    expect(supportText({ kind: "checking" })).toBe("Checking WebGPU…");
    expect(supportText({ kind: "loading-model" })).toBe("Loading the model…");
  });

  it("passes through the sentences only their source can word", () => {
    expect(supportText({ kind: "progress", message: "Fetching the model…" })).toBe(
      "Fetching the model…",
    );
    expect(supportText({ kind: "webgpu", ok: true, message: "WebGPU is ready." })).toBe(
      "WebGPU is ready.",
    );
    expect(supportText({ kind: "failed", message: "No GPU adapter." })).toBe("No GPU adapter.");
  });

  it("names the model that came ready", () => {
    expect(supportText({ kind: "model-ready", modelName: "MiniCPM5 2B" })).toBe(
      "Ready. MiniCPM5 2B is loaded locally on WebGPU.",
    );
  });

  it("names the paths a single run computes, and none twice", () => {
    expect(supportText({ kind: "running", cases: 1, readout: "choices" })).toBe(
      "Running the direct readout…",
    );
    expect(supportText({ kind: "running", cases: 1, readout: "json" })).toBe(
      "Running the token-by-token generation…",
    );
    expect(supportText({ kind: "running", cases: 1, readout: "both" })).toBe(
      "Running the direct readout, then the token-by-token generation…",
    );
  });

  it("counts a batch instead of repeating one line per case", () => {
    expect(supportText({ kind: "running", cases: 4, readout: "both" })).toBe(
      "Running 4 cases on the loaded model…",
    );
  });

  it("says what a finished run produced, and where the input goes from here", () => {
    expect(supportText({ kind: "done", cases: 1, readout: "choices" })).toBe(
      "Direct readout complete. Edit the decision and run again whenever you like.",
    );
    expect(supportText({ kind: "done", cases: 1, readout: "json" })).toBe(
      "Generation complete. Edit the decision and run again whenever you like.",
    );
    expect(supportText({ kind: "done", cases: 1, readout: "both" })).toBe(
      "Comparison complete. Edit the decision and run again whenever you like.",
    );
    expect(supportText({ kind: "done", cases: 3, readout: "both" })).toBe(
      "3 cases complete. Edit the cases and run again whenever you like.",
    );
  });
});
