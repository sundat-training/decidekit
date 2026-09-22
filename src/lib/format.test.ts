import { describe, expect, it } from "vitest";

import { formatRatio } from "@/lib/format";

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
