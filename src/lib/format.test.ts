import { describe, expect, it } from "vitest";

import {
  formatRatio,
  formatSecondsOrDash,
  formatTokens,
  NOT_MEASURED,
  pluralize,
} from "@/lib/format";

describe("measured values", () => {
  it("renders a wall time that exists and a dash for one that does not", () => {
    expect(formatSecondsOrDash(1234)).toBe("1.234 s");
    expect(formatSecondsOrDash(null)).toBe(NOT_MEASURED);
    // Zero is a measurement, so it must not read as a missing one.
    expect(formatSecondsOrDash(0)).toBe("0.000 s");
  });

  it("renders a token count and a dash for a missing one", () => {
    expect(formatTokens(120)).toBe("120 tok");
    expect(formatTokens(0)).toBe("0 tok");
    expect(formatTokens(null)).toBe(NOT_MEASURED);
  });

  it("counts in both directions", () => {
    expect(pluralize(1, "case")).toBe("1 case");
    expect(pluralize(2, "case")).toBe("2 cases");
    expect(pluralize(1, "readout")).toBe("1 readout");
  });
});

/**
 * The verdict bar and the case table both print this string, so the rounding
 * and the guards are defined here once.
 */
describe("wall-time ratio", () => {
  it("renders the generation time relative to the direct time", () => {
    expect(formatRatio(900, 5400)).toBe("6.00×");
    expect(formatRatio(1000, 1234)).toBe("1.23×");
    expect(formatRatio(900, 900)).toBe("1.00×");
  });

  it("reports nothing when a time is missing", () => {
    expect(formatRatio(null, 5400)).toBeNull();
    expect(formatRatio(900, null)).toBeNull();
    expect(formatRatio(null, null)).toBeNull();
  });

  it("reports nothing rather than an infinity for a zero direct time", () => {
    expect(formatRatio(0, 5400)).toBeNull();
    expect(formatRatio(0, 0)).toBeNull();
  });
});
