import { describe, expect, it } from "vitest";

import { describeVerdict, VERDICT_IDLE_RATIO } from "@/lib/verdict";

describe("verdict line", () => {
  it("stays idle until both times exist", () => {
    const verdict = describeVerdict({
      readout: "both",
      directMs: 900,
      generationMs: null,
      generatedTokens: null,
    });

    expect(verdict.label).toBe("measured wall-time ratio");
    expect(verdict.ratio).toBe(VERDICT_IDLE_RATIO);
    expect(verdict.note).toMatch(/run sequentially/);
  });

  it("compares the two wall times when both ran", () => {
    const verdict = describeVerdict({
      readout: "both",
      directMs: 900,
      generationMs: 5400,
      generatedTokens: 30,
    });

    expect(verdict.ratio).toBe("6.00× generation / direct");
    expect(verdict.note).toContain("Direct: 0.900 s");
    expect(verdict.note).toContain("Generation: 5.400 s");
  });

  it("reports a single forward pass without implying a comparison", () => {
    const verdict = describeVerdict({
      readout: "choices",
      directMs: 900,
      generationMs: 5400,
      generatedTokens: 30,
    });

    expect(verdict.label).toBe("measured wall time");
    expect(verdict.ratio).toBe("direct · 0.900 s");
    expect(verdict.note).toMatch(/not comparable/);
  });

  it("reports the generation alone with the tokens it decoded", () => {
    const verdict = describeVerdict({
      readout: "json",
      directMs: null,
      generationMs: 2600,
      generatedTokens: 40,
    });

    expect(verdict.label).toBe("measured wall time");
    expect(verdict.ratio).toBe("json · 2.600 s");
    expect(verdict.note).toContain("40 tokens decoded");
    expect(verdict.note).toMatch(/no second readout/);
  });

  it("describes what the selected mode will do before it has run", () => {
    expect(
      describeVerdict({
        readout: "choices",
        directMs: null,
        generationMs: null,
        generatedTokens: null,
      }).note,
    ).toMatch(/no tokens to decode/);

    expect(
      describeVerdict({
        readout: "json",
        directMs: null,
        generationMs: null,
        generatedTokens: null,
      }).note,
    ).toMatch(/direct readout is skipped/);
  });
});
