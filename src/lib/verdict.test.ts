import { describe, expect, it } from "vitest";

import { describeVerdict, VERDICT_IDLE_RATIO } from "@/lib/verdict";

describe("verdict line", () => {
  it("compares the two wall times when both ran", () => {
    const verdict = describeVerdict({ readout: "both", directMs: 900, generationMs: 5400 });

    expect(verdict.label).toBe("measured wall-time ratio");
    expect(verdict.ratio).toBe("6.00× generation / direct");
  });

  it("reports a single readout as a wall time, not a ratio", () => {
    expect(describeVerdict({ readout: "choices", directMs: 900, generationMs: 5400 })).toEqual({
      label: "measured wall time",
      ratio: "direct · 0.900 s",
    });

    expect(describeVerdict({ readout: "json", directMs: null, generationMs: 2600 })).toEqual({
      label: "measured wall time",
      ratio: "json · 2.600 s",
    });
  });

  it("stays idle until the times it needs exist", () => {
    expect(describeVerdict({ readout: "both", directMs: 900, generationMs: null }).ratio).toBe(
      VERDICT_IDLE_RATIO,
    );
    expect(describeVerdict({ readout: "choices", directMs: null, generationMs: 5400 }).ratio).toBe(
      VERDICT_IDLE_RATIO,
    );
    expect(describeVerdict({ readout: "json", directMs: 900, generationMs: null }).ratio).toBe(
      VERDICT_IDLE_RATIO,
    );
  });
});
