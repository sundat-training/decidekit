import { describe, expect, it } from "vitest";

import exampleFile from "../../public/examples/cases.json?raw";
import { parseCaseFile } from "@/lib/cases";

const INPUT = {
  state: "A password reset succeeded, but logins still fail.",
  question: "Which queue should handle this request?",
  options: ["Account access support", "Billing support", "Close as resolved"],
};

function file(cases: unknown[]): string {
  return JSON.stringify({ cases });
}

describe("case file", () => {
  it("reads a case with an explicit id and type", () => {
    const parsed = parseCaseFile(file([{ id: "account", type: "decision", input: INPUT }]));

    expect(parsed).toEqual({
      ok: true,
      cases: [{ id: "account", type: "decision", input: INPUT }],
    });
  });

  it("defaults the type to decision and names an unnamed case by position", () => {
    const parsed = parseCaseFile(file([{ input: INPUT }]));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.cases[0].type).toBe("decision");
    expect(parsed.cases[0].id).toBe("decision 1");
  });

  it("trims the state, the question and every option", () => {
    const parsed = parseCaseFile(
      file([
        {
          input: {
            state: "  padded  ",
            question: "  Which one?  ",
            options: ["  first  ", "second"],
          },
        },
      ]),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.cases[0].input).toEqual({
      state: "padded",
      question: "Which one?",
      options: ["first", "second"],
    });
  });

  it("reports invalid JSON instead of throwing", () => {
    const parsed = parseCaseFile('{"cases": [');

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toMatch(/not valid JSON/);
  });

  it("requires a nonempty cases array", () => {
    for (const text of ["{}", '{"cases": {}}', '{"cases": []}']) {
      expect(parseCaseFile(text).ok).toBe(false);
    }

    const parsed = parseCaseFile('{"cases": []}');
    if (parsed.ok) return;
    expect(parsed.error).toMatch(/at least one case/);
  });

  it("rejects a case that is not an object", () => {
    const parsed = parseCaseFile(file(["nope"]));

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toBe("cases[0] must be an object.");
  });

  it("rejects a type this build cannot run", () => {
    const parsed = parseCaseFile(file([{ type: "ranking", input: INPUT }]));

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toBe("cases[0].type must be one of: decision.");
  });

  it("rejects two cases that share an id", () => {
    const parsed = parseCaseFile(
      file([
        { id: "same", input: INPUT },
        { id: "same", input: INPUT },
      ]),
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toMatch(/used more than once/);
  });

  it("rejects an empty id", () => {
    expect(parseCaseFile(file([{ id: "   ", input: INPUT }])).ok).toBe(false);
    expect(parseCaseFile(file([{ id: 7, input: INPUT }])).ok).toBe(false);
  });

  it("rejects an input that is missing, malformed or out of bounds", () => {
    expect(parseCaseFile(file([{ id: "a" }])).ok).toBe(false);
    expect(parseCaseFile(file([{ input: { state: "s", question: "q" } }])).ok).toBe(false);
    expect(parseCaseFile(file([{ input: { ...INPUT, options: ["the only choice"] } }])).ok).toBe(
      false,
    );
    expect(parseCaseFile(file([{ input: { ...INPUT, options: ["one", "  "] } }])).ok).toBe(false);
    expect(parseCaseFile(file([{ input: { ...INPUT, options: [1, 2] } }])).ok).toBe(false);
  });

  it("names the failing case and field", () => {
    const parsed = parseCaseFile(
      file([{ input: INPUT }, { id: "broken", input: { ...INPUT, state: " " } }]),
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toBe("cases[1].input: State, question and every option must be nonempty.");
  });

  /**
   * The file under `public/examples/` is what a visitor downloads, so it must
   * keep parsing: the format may not drift away from its own example.
   */
  it("parses the example file it ships", () => {
    const parsed = parseCaseFile(exampleFile);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.cases.map((item) => item.id)).toEqual([
      "account-support",
      "email-triage",
      "ticket-priority",
      "release-gate",
    ]);
    // The example covers both ends of the option bounds and both forms of `type`.
    expect(parsed.cases.map((item) => item.input.options.length)).toEqual([3, 3, 4, 2]);
    expect(parsed.cases.every((item) => item.type === "decision")).toBe(true);
  });
});
