/**
 * The two readout paths, written against a narrow completion interface so the
 * timing and validation rules can be exercised without a GPU.
 */

import {
  assertValidOptionLogprobs,
  buildMessages,
  GENERATION_MAX_TOKENS,
  grammarFor,
  optionLabels,
  readOptionLogprobs,
  softmax,
  validateGeneration,
  type ChatCompletionResponse,
  type ChatMessage,
  type DecisionInput,
} from "@/lib/decision";
import type { ModelTier } from "@/lib/models";

import type { DirectResult, GenerationResult, GenerationUpdate } from "./protocol";

export interface ChatCompletionRequest {
  messages: ChatMessage[];
  max_tokens: number;
  temperature: number;
  cache_prompt: boolean;
  chat_template_kwargs: { enable_thinking: boolean };
  stream?: boolean;
  top_k?: number;
  top_p?: number;
  logprobs?: boolean;
  top_logprobs?: number;
  logit_bias?: Record<string, number>;
  grammar?: string;
}

export type CompletionStream = AsyncIterable<ChatCompletionResponse>;

export interface CompletionClient {
  createChatCompletion(
    request: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse | CompletionStream>;
}

export type Clock = () => number;

const defaultClock: Clock = () => performance.now();

export function isAsyncIterable(value: unknown): value is CompletionStream {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as AsyncIterable<unknown>)[Symbol.asyncIterator] === "function"
  );
}

/**
 * Path 1: one constrained forward pass. The grammar forces a single option
 * letter and the logit bias keeps the readout on that letter, then the log
 * probabilities are normalized across exactly the supplied options.
 */
export async function runDirectReadout(
  client: CompletionClient,
  input: DecisionInput,
  model: ModelTier,
  now: Clock = defaultClock,
): Promise<DirectResult> {
  const started = now();
  const labels = optionLabels(input.options.length);

  const response = await client.createChatCompletion({
    messages: buildMessages(input, "direct"),
    max_tokens: 1,
    temperature: 1,
    top_k: 0,
    top_p: 1,
    logprobs: true,
    top_logprobs: 20,
    logit_bias: Object.fromEntries(
      labels.map((_, index) => [String(model.labelBase + index), 100]),
    ),
    grammar: grammarFor(labels),
    cache_prompt: false,
    chat_template_kwargs: { enable_thinking: false },
  });

  if (isAsyncIterable(response)) {
    throw new Error("The direct readout expected a single completion, not a stream.");
  }

  const logits = readOptionLogprobs(response, labels);
  assertValidOptionLogprobs(logits, labels);
  const probabilities = softmax(logits);

  return {
    totalMs: now() - started,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    readouts: 1,
    options: input.options.map((description, index) => ({
      label: labels[index],
      description,
      probability: probabilities[index],
      logit: logits[index],
    })),
  };
}

/**
 * Path 2: the same distribution, decoded token by token. Every chunk is
 * forwarded so the UI can show partial JSON and time to first token.
 */
export async function runGeneration(
  client: CompletionClient,
  input: DecisionInput,
  onUpdate: (update: GenerationUpdate) => void,
  now: Clock = defaultClock,
): Promise<GenerationResult> {
  const started = now();
  let firstTokenAt: number | null = null;
  let generatedText = "";
  let usage: ChatCompletionResponse["usage"];

  const stream = await client.createChatCompletion({
    messages: buildMessages(input, "generation"),
    stream: true,
    max_tokens: GENERATION_MAX_TOKENS,
    temperature: 0,
    cache_prompt: false,
    chat_template_kwargs: { enable_thinking: false },
  });

  if (!isAsyncIterable(stream)) {
    throw new Error("The generation path expected a token stream.");
  }

  for await (const chunk of stream) {
    if (chunk.usage) usage = chunk.usage;
    const text = chunk.choices?.[0]?.delta?.content ?? "";
    if (text) {
      if (firstTokenAt === null) firstTokenAt = now();
      generatedText += text;
    }
    // Frames that carry neither content nor usage have nothing to report, and
    // a batch of cases would otherwise push real re-renders for them.
    if (!text && !chunk.usage) continue;
    onUpdate({
      text: generatedText,
      tokens: usage?.completion_tokens ?? 0,
      ttftMs: firstTokenAt === null ? null : firstTokenAt - started,
    });
  }

  generatedText = generatedText.trim();

  return {
    generationMs: now() - started,
    inputTokens: usage?.prompt_tokens ?? 0,
    ttftMs: firstTokenAt === null ? null : firstTokenAt - started,
    generatedTokens: usage?.completion_tokens ?? 0,
    generatedText,
    ...validateGeneration(generatedText, input),
  };
}
