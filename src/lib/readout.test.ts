import { describe, expect, it } from "vitest";

import {
  includesChoices,
  includesJson,
  isComparison,
  isReadoutMode,
  READOUT_LABEL,
  READOUT_MODES,
} from "@/lib/readout";

describe("readout mode", () => {
  it("accepts exactly the three modes and rejects anything else", () => {
    for (const mode of READOUT_MODES) expect(isReadoutMode(mode)).toBe(true);
    expect(isReadoutMode("direct")).toBe(false);
    expect(isReadoutMode("")).toBe(false);
  });

  it("names every mode", () => {
    expect(READOUT_MODES.map((mode) => READOUT_LABEL[mode])).toEqual([
      "Choices only",
      "JSON only",
      "Both",
    ]);
  });

  it("says which paths a mode computes", () => {
    expect([includesChoices("choices"), includesJson("choices")]).toEqual([true, false]);
    expect([includesChoices("json"), includesJson("json")]).toEqual([false, true]);
    expect([includesChoices("both"), includesJson("both")]).toEqual([true, true]);
  });

  it("calls only the mode that runs both paths a comparison", () => {
    expect(isComparison("both")).toBe(true);
    expect(isComparison("choices")).toBe(false);
    expect(isComparison("json")).toBe(false);
  });
});
