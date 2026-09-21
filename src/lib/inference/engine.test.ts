import { describe, expect, it } from "vitest";

import type { ChatCompletionResponse, DecisionInput } from "@/lib/decision";
import {
  isAsyncIterable,
  runDirectReadout,
  runGeneration,
  type ChatCompletionRequest,
  type CompletionClient,
  type CompletionStream,
} from "@/lib/inference/engine";
import type { GenerationUpdate } from "@/lib/inference/protocol";
import { MODELS } from "@/lib/models";

const THREE: DecisionInput = {
  state: "A customer cannot log in.",
  question: "Which queue should handle this request?",
  options: ["Account access support", "Billing support", "Close as resolved"],
};

const TWO: DecisionInput = {
  state: "An email asks for a password.",
  question: "How should this email be classified?",
  options: ["x", "y"],
};

class FakeClient implements CompletionClient {
  readonly requests: ChatCompletionRequest[] = [];
  private readonly respond: (
    request: ChatCompletionRequest,
  ) => ChatCompletionResponse | CompletionStream;

  constructor(
    respond: (request: ChatCompletionRequest) => ChatCompletionResponse | CompletionStream,
  ) {
    this.respond = respond;
  }

  async createChatCompletion(
    request: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse | CompletionStream> {
    this.requests.push(request);
    return this.respond(request);
  }
}

/** Deterministic clock: returns each value once, then repeats the last one. */
function sequenceClock(...values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[Math.min(index, values.length - 1)];
    index += 1;
    return value;
  };
}

function streamOf(chunks: ChatCompletionResponse[]): CompletionStream {
  return (async function* generate() {
    for (const chunk of chunks) yield chunk;
  })();
}

const directResponse = (topLogprobs: Array<{ token: string; logprob: number }>) => ({
  choices: [{ logprobs: { content: [{ top_logprobs: topLogprobs }] } }],
  usage: { prompt_tokens: 128 },
});

describe("direct readout", () => {
  it("normalizes the option logits and reports the wall time", async () => {
    const client = new FakeClient(() =>
      directResponse([
        { token: "A", logprob: 0 },
        { token: "B", logprob: -1 },
        { token: "C", logprob: -1 },
      ]),
    );

    const result = await runDirectReadout(
      client,
      THREE,
      MODELS["minicpm5-2b"],
      sequenceClock(0, 120),
    );

    expect(result.totalMs).toBe(120);
    expect(result.inputTokens).toBe(128);
    expect(result.readouts).toBe(1);
    expect(result.options.map((option) => option.label)).toEqual(["A", "B", "C"]);
    expect(result.options.map((option) => option.description)).toEqual(THREE.options);
    expect(result.options.map((option) => option.logit)).toEqual([0, -1, -1]);
    expect(result.options.reduce((sum, option) => sum + option.probability, 0)).toBeCloseTo(1, 12);
    expect(result.options[0].probability).toBeGreaterThan(result.options[1].probability);
  });

  it("constrains the request to one letter per option", async () => {
    const client = new FakeClient(() =>
      directResponse([
        { token: "A", logprob: -0.1 },
        { token: "B", logprob: -0.2 },
        { token: "C", logprob: -0.3 },
      ]),
    );

    await runDirectReadout(client, THREE, MODELS["minicpm5-2b"]);

    const request = client.requests[0];
    expect(request.max_tokens).toBe(1);
    expect(request.logprobs).toBe(true);
    expect(request.top_logprobs).toBe(20);
    expect(request.temperature).toBe(1);
    expect(request.top_k).toBe(0);
    expect(request.top_p).toBe(1);
    expect(request.cache_prompt).toBe(false);
    expect(request.stream).toBeUndefined();
    expect(request.chat_template_kwargs).toEqual({ enable_thinking: false });
    expect(request.grammar).toBe('root ::= "A" | "B" | "C"');
    expect(request.messages[1].content).toContain(
      "Reply with exactly one option letter from: A, B, C.",
    );
  });

  it("biases the token ids that follow from the selected model", async () => {
    const client = new FakeClient(() =>
      directResponse([
        { token: "A", logprob: -0.1 },
        { token: "B", logprob: -0.2 },
      ]),
    );

    await runDirectReadout(client, TWO, MODELS["qwen3-0.6b"]);
    expect(client.requests[0].logit_bias).toEqual({ "32": 100, "33": 100 });

    await runDirectReadout(client, TWO, MODELS["minicpm5-2b"]);
    expect(client.requests[1].logit_bias).toEqual({ "54": 100, "55": 100 });
  });

  it("refuses a streaming response", async () => {
    const client = new FakeClient(() => streamOf([]));
    await expect(runDirectReadout(client, THREE, MODELS["minicpm5-2b"])).rejects.toThrow(
      "The direct readout expected a single completion, not a stream.",
    );
  });

  it("refuses logits that do not cover every option", async () => {
    const client = new FakeClient(() =>
      directResponse([
        { token: "A", logprob: -0.1 },
        { token: "B", logprob: -0.2 },
      ]),
    );
    await expect(runDirectReadout(client, THREE, MODELS["minicpm5-2b"])).rejects.toThrow(
      /did not return valid option logits for A, B, C/,
    );
  });
});

describe("generation", () => {
  it("streams every chunk, times the first token and validates the JSON", async () => {
    const client = new FakeClient(() =>
      streamOf([
        { choices: [{ delta: { content: '{"A: x"' } }] },
        { choices: [{ delta: { content: ': 0.7, "B: y": 0.3}' } }] },
        {
          choices: [{ delta: { content: "" } }],
          usage: { prompt_tokens: 200, completion_tokens: 12 },
        },
      ]),
    );
    const updates: GenerationUpdate[] = [];

    const result = await runGeneration(
      client,
      TWO,
      (update) => updates.push(update),
      sequenceClock(0, 40, 260),
    );

    expect(result.generationMs).toBe(260);
    expect(result.ttftMs).toBe(40);
    expect(result.inputTokens).toBe(200);
    expect(result.generatedTokens).toBe(12);
    expect(result.generatedText).toBe('{"A: x": 0.7, "B: y": 0.3}');
    expect(result.valid).toBe(true);
    expect(result.choice).toBe("A");
    expect(result.choiceDescription).toBe("x");

    expect(updates).toHaveLength(3);
    expect(updates[0]).toEqual({ text: '{"A: x"', tokens: 0, ttftMs: 40 });
    expect(updates[1].text).toBe('{"A: x": 0.7, "B: y": 0.3}');
    expect(updates.at(-1)?.tokens).toBe(12);
  });

  it("asks for a greedy, streaming completion", async () => {
    const client = new FakeClient(() => streamOf([{ choices: [{ delta: { content: "{}" } }] }]));
    await runGeneration(client, TWO, () => {});

    const request = client.requests[0];
    expect(request.stream).toBe(true);
    expect(request.max_tokens).toBe(512);
    expect(request.temperature).toBe(0);
    expect(request.cache_prompt).toBe(false);
    expect(request.messages[1].content).toContain("Output JSON only");
  });

  it("reports a time to first token of null when nothing was generated", async () => {
    const client = new FakeClient(() => streamOf([{ choices: [{ delta: { content: "" } }] }]));
    const result = await runGeneration(client, TWO, () => {}, sequenceClock(0, 90));

    expect(result.ttftMs).toBeNull();
    expect(result.generatedTokens).toBe(0);
    expect(result.valid).toBe(false);
  });

  it("keeps unusable output instead of throwing", async () => {
    const client = new FakeClient(() =>
      streamOf([{ choices: [{ delta: { content: "  I would say option A.  " } }] }]),
    );
    const result = await runGeneration(client, TWO, () => {});

    expect(result.generatedText).toBe("I would say option A.");
    expect(result.valid).toBe(false);
    expect(result.validationError).not.toBe("");
    expect(result.choice).toBeNull();
  });

  it("refuses a non-streaming response", async () => {
    const client = new FakeClient(() => ({ choices: [{ message: { content: "{}" } }] }));
    await expect(runGeneration(client, TWO, () => {})).rejects.toThrow(
      "The generation path expected a token stream.",
    );
  });
});

describe("stream detection", () => {
  it("recognizes async iterables only", () => {
    expect(isAsyncIterable(streamOf([]))).toBe(true);
    expect(isAsyncIterable({ choices: [] })).toBe(false);
    expect(isAsyncIterable(null)).toBe(false);
    expect(isAsyncIterable("text")).toBe(false);
  });
});
