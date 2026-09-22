import { describe, expect, it } from "vitest";

import type { GenerationResult } from "@/lib/inference/protocol";
import { validationLine, verdictRatio, VERDICT_IDLE_RATIO } from "@/lib/verdict";

function generation(overrides: Partial<GenerationResult> = {}): GenerationResult {
  return {
    generationMs: 5400,
    inputTokens: 120,
    ttftMs: 300,
    generatedTokens: 30,
    generatedText: "{}",
    valid: true,
    choice: "A",
    choiceDescription: "Account access support",
    probabilities: [1, 0, 0],
    validationError: "",
    strippedFence: false,
    ...overrides,
  };
}

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

describe("validation line", () => {
  it("names the top choice of a valid generation", () => {
    expect(validationLine(generation())).toEqual({
      tone: "ok",
      text: "valid JSON · top choice A",
    });
  });

  it("mentions an unwrapped code fence, which the prompt explicitly forbids", () => {
    expect(validationLine(generation({ strippedFence: true })).text).toBe(
      "valid JSON · code fence stripped · top choice A",
    );
  });

  it("reports why an unusable output could not be read", () => {
    expect(
      validationLine(
        generation({
          valid: false,
          choice: null,
          choiceDescription: null,
          probabilities: [],
          validationError: "expected one JSON object",
        }),
      ),
    ).toEqual({ tone: "error", text: "unusable output · expected one JSON object" });
  });
});
