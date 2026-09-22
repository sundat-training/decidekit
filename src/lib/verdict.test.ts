import { describe, expect, it } from "vitest";

import { verdictRatio, VERDICT_IDLE_RATIO } from "@/lib/verdict";

describe("verdict ratio", () => {
  it("compares the two wall times when both ran", () => {
    expect(verdictRatio({ readout: "both", directMs: 900, generationMs: 5400 })).toBe(
      "6.00× generation / direct",
    );
  });

  it("stays idle in both mode until the two times exist", () => {
    expect(verdictRatio({ readout: "both", directMs: 900, generationMs: null })).toBe(
      VERDICT_IDLE_RATIO,
    );
    expect(verdictRatio({ readout: "both", directMs: null, generationMs: null })).toBe(
      VERDICT_IDLE_RATIO,
    );
  });

  it("reports nothing for a single path, which has no counterpart", () => {
    expect(verdictRatio({ readout: "choices", directMs: 900, generationMs: 5400 })).toBeNull();
    expect(verdictRatio({ readout: "json", directMs: 900, generationMs: 5400 })).toBeNull();
    expect(verdictRatio({ readout: "choices", directMs: null, generationMs: null })).toBeNull();
  });
});
