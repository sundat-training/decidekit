import { describe, expect, it } from "vitest";

import type { Case, CaseOutcome } from "@/lib/cases";
import type { ScoredOption } from "@/lib/decision";
import type { DirectResult, GenerationResult } from "@/lib/inference/protocol";
import {
  batchDurationMs,
  caseDurationMs,
  choiceScores,
  durationDetail,
  generationScores,
  splitDistribution,
} from "@/lib/results";

const CASE: Case = {
  id: "first",
  type: "decision",
  input: { state: "A state", question: "A question?", options: ["One", "Two"] },
};

const DIRECT: DirectResult = {
  totalMs: 900,
  inputTokens: 120,
  readouts: 1,
  options: [
    { label: "A", description: "One", probability: 0.7, logit: -0.1 },
    { label: "B", description: "Two", probability: 0.3, logit: -1.5 },
  ],
};

const GENERATION: GenerationResult = {
  generationMs: 5400,
  inputTokens: 120,
  ttftMs: 300,
  generatedTokens: 30,
  generatedText: "{}",
  valid: true,
  choice: "B",
  choiceDescription: "Two",
  probabilities: [0.2, 0.8],
  validationError: "",
  strippedFence: false,
};

function outcome({
  direct = null,
  generation = null,
}: {
  direct?: DirectResult | null;
  generation?: GenerationResult | null;
}): CaseOutcome {
  return { id: "first", direct, generation };
}

function scores(...probabilities: number[]): ScoredOption[] {
  return probabilities.map((probability, index) => ({
    label: String.fromCharCode(65 + index),
    description: `Option ${String.fromCharCode(65 + index)}`,
    probability,
  }));
}

describe("distribution split", () => {
  it("leads with the winner and keeps the rest in the given order", () => {
    const split = splitDistribution(scores(0.2, 0.7, 0.1));

    expect(split?.lead.label).toBe("B");
    expect(split?.rest.map((option) => option.label)).toEqual(["A", "C"]);
  });

  it("gives a tie to the earlier option, the rule the generation validates with", () => {
    expect(splitDistribution(scores(0.5, 0.5))?.lead.label).toBe("A");
  });

  it("has nothing to lead an empty distribution", () => {
    expect(splitDistribution([])).toBeNull();
  });
});

describe("case scores", () => {
  it("takes the direct scores as they are", () => {
    expect(choiceScores(outcome({ direct: DIRECT }))).toEqual(DIRECT.options);
    expect(choiceScores(undefined)).toEqual([]);
  });

  it("shows the direct readout of a case that is still running", () => {
    // The case has no outcome yet, but its direct pass already returned.
    expect(choiceScores(undefined, DIRECT)).toEqual(DIRECT.options);
  });

  it("prefers the case's own readout over one still in flight", () => {
    const other: DirectResult = {
      ...DIRECT,
      options: [{ label: "A", description: "One", probability: 1, logit: 0 }],
    };

    expect(choiceScores(outcome({ direct: DIRECT }), other)).toEqual(DIRECT.options);
  });

  it("rebuilds the generation distribution from its probabilities and the options", () => {
    expect(generationScores(CASE, outcome({ generation: GENERATION }))).toEqual([
      { label: "A", description: "One", probability: 0.2 },
      { label: "B", description: "Two", probability: 0.8 },
    ]);
  });

  it("has no scores when the generation parsed nothing", () => {
    const unusable: GenerationResult = { ...GENERATION, valid: false, probabilities: [] };

    expect(generationScores(CASE, outcome({ generation: unusable }))).toEqual([]);
    expect(generationScores(CASE, undefined)).toEqual([]);
  });
});

describe("case durations", () => {
  it("sums every path that ran for a case", () => {
    expect(caseDurationMs(outcome({ direct: DIRECT, generation: GENERATION }))).toBe(6300);
    expect(caseDurationMs(outcome({ direct: DIRECT }))).toBe(900);
    expect(caseDurationMs(outcome({ generation: GENERATION }))).toBe(5400);
  });

  it("has no time for a case that did not run", () => {
    expect(caseDurationMs(undefined)).toBeNull();
    expect(caseDurationMs(outcome({}))).toBeNull();
  });

  it("totals the cases that finished", () => {
    expect(batchDurationMs([])).toBeNull();
    expect(batchDurationMs([outcome({ direct: DIRECT }), outcome({ direct: DIRECT })])).toBe(1800);
    // A case without a result contributes nothing and cannot invent a zero.
    expect(batchDurationMs([outcome({}), outcome({})])).toBeNull();
    expect(batchDurationMs([outcome({}), outcome({ direct: DIRECT })])).toBe(900);
  });

  it("names both paths in the hover detail", () => {
    expect(durationDetail(outcome({ direct: DIRECT, generation: GENERATION }))).toBe(
      "direct 0.900 s · json 5.400 s",
    );
    expect(durationDetail(outcome({ direct: DIRECT }))).toBe("direct 0.900 s");
    expect(durationDetail(outcome({ generation: GENERATION }))).toBe("json 5.400 s");
    expect(durationDetail(outcome({}))).toBeUndefined();
    expect(durationDetail(undefined)).toBeUndefined();
  });
});
