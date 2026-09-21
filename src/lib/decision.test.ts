import { describe, expect, it } from "vitest";

import {
  assertValidOptionLogprobs,
  buildMessages,
  expectedKeys,
  extractJsonPayload,
  GENERATION_MAX_TOKENS,
  grammarFor,
  optionBlock,
  readOptionLogprobs,
  softmax,
  validateDecisionInput,
  validateGeneration,
  type ChatCompletionResponse,
  type DecisionInput,
} from "@/lib/decision";
import { MAX_OPTIONS, MIN_OPTIONS, optionLabels } from "@/lib/labels";

const INPUT: DecisionInput = {
  state: "A customer cannot log in.",
  question: "Which queue should handle this request?",
  options: ["Account access support", "Billing support"],
};

const THREE: DecisionInput = {
  ...INPUT,
  options: ["Account access support", "Billing support", "Close as resolved"],
};

function userMessage(mode: "direct" | "generation"): string {
  const messages = buildMessages(INPUT, mode);
  expect(messages).toHaveLength(2);
  expect(messages[0].role).toBe("system");
  expect(messages[1].role).toBe("user");
  return messages[1].content;
}

describe("option labels", () => {
  it("derives letters from the option position", () => {
    expect(optionLabels(1)).toEqual(["A"]);
    expect(optionLabels(3)).toEqual(["A", "B", "C"]);
  });

  it("stops at T for the maximum option count", () => {
    const labels = optionLabels(MAX_OPTIONS);
    expect(labels).toHaveLength(20);
    expect(labels.at(-1)).toBe("T");
    expect(MIN_OPTIONS).toBe(2);
    expect(MAX_OPTIONS).toBe(20);
  });

  it("formats an option block with one letter per line", () => {
    expect(optionBlock(["north", "south"])).toBe("A. north\nB. south");
  });
});

describe("prompt construction", () => {
  it("asks the direct path for exactly one letter", () => {
    const content = userMessage("direct");
    expect(content).toContain("Reply with exactly one option letter from: A, B.");
    expect(content).toContain("State:\nA customer cannot log in.");
    expect(content).toContain("Question:\nWhich queue should handle this request?");
    expect(content).toContain("Allowed options:\nA. Account access support\nB. Billing support");
  });

  it("asks the generation path for the same distribution as JSON", () => {
    const content = userMessage("generation");
    expect(content).toContain(
      "Return only one JSON object mapping each option to its probability.",
    );
    expect(content).toContain('"A. Route north"');
    expect(content).toContain("Route south");
    expect(content).toContain("probabilities must sum to 1");
    expect(content).toContain("Output JSON only, with no markdown or explanation.");
  });

  it("keeps the system instruction identical for both paths", () => {
    expect(buildMessages(INPUT, "direct")[0]).toEqual(buildMessages(INPUT, "generation")[0]);
    expect(buildMessages(INPUT, "direct")[0].content).toContain(
      "Follow the output format exactly.",
    );
  });

  it("restricts decoding to the supplied labels", () => {
    expect(grammarFor(["A", "B", "C"])).toBe('root ::= "A" | "B" | "C"');
  });

  it("expects one exact key per option", () => {
    expect(expectedKeys(INPUT)).toEqual(["A: Account access support", "B: Billing support"]);
  });

  it("allows a generous but bounded generation budget", () => {
    expect(GENERATION_MAX_TOKENS).toBe(512);
  });
});

describe("softmax", () => {
  it("normalizes to one", () => {
    const probabilities = softmax([-0.2, -1.4, -3.1]);
    expect(probabilities.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 12);
  });

  it("keeps the ordering of the logits", () => {
    const [first, second, third] = softmax([0, -1, -2]);
    expect(first).toBeGreaterThan(second);
    expect(second).toBeGreaterThan(third);
  });

  it("is uniform for equal logits", () => {
    expect(softmax([2, 2, 2, 2])).toEqual([0.25, 0.25, 0.25, 0.25]);
  });

  it("stays finite for very large logits", () => {
    const probabilities = softmax([1000, 1000]);
    expect(probabilities).toEqual([0.5, 0.5]);
    expect(probabilities.every(Number.isFinite)).toBe(true);
  });
});

describe("option logits", () => {
  const response: ChatCompletionResponse = {
    choices: [
      {
        logprobs: {
          content: [
            {
              top_logprobs: [
                { token: "A", logprob: -0.1 },
                { token: "B", logprob: -2.3 },
              ],
            },
          ],
        },
      },
    ],
  };

  it("reads letter tokens", () => {
    expect(readOptionLogprobs(response, ["A", "B"])).toEqual([-0.1, -2.3]);
  });

  it("reads single-byte tokens", () => {
    const byBytes: ChatCompletionResponse = {
      choices: [
        {
          logprobs: {
            content: [{ top_logprobs: [{ token: "", logprob: -0.5, bytes: ["B".charCodeAt(0)] }] }],
          },
        },
      ],
    };
    expect(readOptionLogprobs(byBytes, ["B"])).toEqual([-0.5]);
  });

  it("reports a missing option as not a number", () => {
    expect(readOptionLogprobs(response, ["A", "C"])).toEqual([-0.1, Number.NaN]);
  });

  it("rejects incomplete or non-finite logits", () => {
    expect(() => assertValidOptionLogprobs([-0.1, Number.NaN], ["A", "B"])).toThrow(
      /did not return valid option logits for A, B/,
    );
    expect(() => assertValidOptionLogprobs([-0.1], ["A", "B"])).toThrow(/valid option logits/);
    expect(() => assertValidOptionLogprobs([-0.1, -0.2], ["A", "B"])).not.toThrow();
  });
});

describe("generation validation", () => {
  it("accepts a well formed distribution and reports the top choice", () => {
    const verdict = validateGeneration(
      '{"A: Account access support": 0.62, "B: Billing support": 0.38}',
      INPUT,
    );
    expect(verdict).toEqual({
      valid: true,
      choice: "A",
      choiceDescription: "Account access support",
      validationError: "",
      strippedFence: false,
    });
  });

  it("unwraps a Markdown code fence", () => {
    const verdict = validateGeneration(
      '```json\n{"A: Account access support": 0.5, "B: Billing support": 0.4, "C: Close as resolved": 0.1}\n```',
      THREE,
    );
    expect(verdict.valid).toBe(true);
    expect(verdict.strippedFence).toBe(true);
    expect(verdict.choice).toBe("A");
    expect(verdict.validationError).toBe("");
  });

  it("unwraps a bare fence that is surrounded by prose", () => {
    const verdict = validateGeneration(
      'Here is the distribution:\n```\n{"A: Account access support": 0.2, "B: Billing support": 0.8}\n```\nHope that helps.',
      INPUT,
    );
    expect(verdict.valid).toBe(true);
    expect(verdict.strippedFence).toBe(true);
    expect(verdict.choice).toBe("B");
  });

  it("unwraps a fence that follows a thinking block", () => {
    const verdict = validateGeneration(
      '<think>weighing options</think>\n```json\n{"A: Account access support": 0.3, "B: Billing support": 0.7}\n```',
      INPUT,
    );
    expect(verdict.valid).toBe(true);
    expect(verdict.strippedFence).toBe(true);
    expect(verdict.choice).toBe("B");
  });

  it("still rejects a fenced payload that does not match the options", () => {
    const verdict = validateGeneration('```json\n{"A: something else": 1}\n```', INPUT);
    expect(verdict.valid).toBe(false);
    expect(verdict.strippedFence).toBe(true);
    expect(verdict.validationError).toBe("expected one probability for every exact option key");
  });

  it("keeps an unfenced payload unstripped", () => {
    const { payload, strippedFence } = extractJsonPayload('  {"A": 1}  ');
    expect(payload).toBe('{"A": 1}');
    expect(strippedFence).toBe(false);
  });

  it("strips a thinking block before parsing", () => {
    const verdict = validateGeneration(
      '<think>weighing options</think>{"A: Account access support": 0.4, "B: Billing support": 0.6}',
      INPUT,
    );
    expect(verdict.valid).toBe(true);
    expect(verdict.choice).toBe("B");
  });

  it("rejects a distribution that does not sum to one", () => {
    const verdict = validateGeneration(
      '{"A: Account access support": 0.9, "B: Billing support": 0.6}',
      INPUT,
    );
    expect(verdict.valid).toBe(false);
    expect(verdict.validationError).toBe("probabilities must sum to 1");
  });

  it("rejects missing, extra or renamed keys", () => {
    expect(validateGeneration('{"A: Account access support": 1}', INPUT).validationError).toBe(
      "expected one probability for every exact option key",
    );
    expect(
      validateGeneration('{"A: Account access support": 0.5, "C: Billing support": 0.5}', INPUT)
        .validationError,
    ).toBe("expected one probability for every exact option key");
  });

  it("rejects out-of-range values", () => {
    const verdict = validateGeneration(
      '{"A: Account access support": 1.4, "B: Billing support": -0.4}',
      INPUT,
    );
    expect(verdict.validationError).toBe("probabilities must be numbers from 0 to 1");
  });

  it("rejects anything that is not a JSON object", () => {
    expect(validateGeneration("[0.5, 0.5]", INPUT).validationError).toBe(
      "expected one JSON object",
    );
    expect(validateGeneration("not json at all", INPUT).valid).toBe(false);
    expect(validateGeneration("not json at all", INPUT).choice).toBeNull();
  });
});

describe("decision guard", () => {
  it("accepts a complete decision", () => {
    expect(validateDecisionInput(INPUT)).toBeNull();
  });

  it("requires state, question and every option", () => {
    expect(validateDecisionInput({ ...INPUT, state: "" })).toBe(
      "State, question and every option must be nonempty.",
    );
    expect(validateDecisionInput({ ...INPUT, options: ["only", ""] })).toBe(
      "State, question and every option must be nonempty.",
    );
  });

  it("enforces the option bounds", () => {
    expect(validateDecisionInput({ ...INPUT, options: ["one"] })).toBe(
      "This lab requires 2 to 20 options.",
    );
    expect(
      validateDecisionInput({ ...INPUT, options: Array.from({ length: 21 }, (_, i) => `o${i}`) }),
    ).toBe("This lab requires 2 to 20 options.");
  });
});
