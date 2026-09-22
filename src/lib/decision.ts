/**
 * The decision contract shared by both readout paths.
 *
 * Nothing here touches the DOM, the worker or WebGPU, so the rules that decide
 * what counts as a valid run can be tested directly.
 */

import { MAX_OPTIONS, MIN_OPTIONS, optionLabels } from "./labels";

export interface DecisionInput {
  state: string;
  question: string;
  options: string[];
}

export type ReadoutMode = "direct" | "generation";

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

/** Shape of the completion payload returned by the browser inference engine. */
export interface TopLogprobEntry {
  token: string;
  logprob: number;
  bytes?: number[];
}

export interface ChatCompletionChoice {
  logprobs?: { content?: Array<{ top_logprobs?: TopLogprobEntry[] }> };
  delta?: { content?: string };
  message?: { content?: string };
}

export interface ChatCompletionResponse {
  choices?: ChatCompletionChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export interface GenerationVerdict {
  valid: boolean;
  choice: string | null;
  choiceDescription: string | null;
  validationError: string;
  /** True when the payload had to be unwrapped from a Markdown code fence. */
  strippedFence: boolean;
}

export const GENERATION_MAX_TOKENS = 512;

/**
 * Options are letters, so one constrained readout scores every choice instead
 * of decoding one token per option.
 */
export { MAX_OPTIONS, MIN_OPTIONS, optionLabels } from "./labels";

export function optionBlock(
  options: string[],
  labels: string[] = optionLabels(options.length),
): string {
  return options.map((option, index) => `${labels[index]}. ${option}`).join("\n");
}

export const SYSTEM_PROMPT =
  "Make the requested decision from the supplied state. Follow the output format exactly.";

/**
 * The second path is asked for the same distribution as the first one, but it
 * has to write it out token by token. The example keys are deliberately
 * unrelated to the presets so the model cannot anchor on them.
 */
export function generationInstruction(): string {
  return [
    "Estimate the probability that each allowed option is the correct decision.",
    'Return only one JSON object mapping each option to its probability. Form every key as "<label>: <full option text>" using the allowed options above.',
    'For example, if the unrelated options were "A. Route north" and "B. Route south", valid output would be:',
    '{"A: Route north": 0.65, "B: Route south": 0.35}',
    "For the actual decision, include every supplied option exactly once and in order. Each value must be a JSON number from 0 to 1, and the probabilities must sum to 1. Output JSON only, with no markdown or explanation. Do not wrap it in a code fence.",
  ].join("\n");
}

/** Matches a fenced block, with or without a language tag and surrounding prose. */
const CODE_FENCE = /```[a-zA-Z0-9]*[ \t]*\r?\n?([\s\S]*?)\r?\n?```/;

/**
 * Models routinely wrap a "JSON only" answer in a Markdown code fence, so the
 * wrapper is removed before parsing. Everything else stays strict: the payload
 * itself still has to parse and match the expected keys exactly.
 */
export function extractJsonPayload(raw: string): { payload: string; strippedFence: boolean } {
  const withoutThinking = raw
    .trim()
    .replace(/^<think>[\s\S]*?<\/think>\s*/i, "")
    .trim();
  const fenced = CODE_FENCE.exec(withoutThinking);
  if (fenced) return { payload: fenced[1].trim(), strippedFence: true };
  return { payload: withoutThinking, strippedFence: false };
}

export function directInstruction(labels: string[]): string {
  return `Reply with exactly one option letter from: ${labels.join(", ")}.`;
}

export function buildMessages(input: DecisionInput, mode: ReadoutMode): ChatMessage[] {
  const labels = optionLabels(input.options.length);
  const outputInstruction = mode === "direct" ? directInstruction(labels) : generationInstruction();
  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `State:\n${input.state}\n\nQuestion:\n${input.question}\n\nAllowed options:\n${optionBlock(input.options, labels)}\n\n${outputInstruction}`,
    },
  ];
}

/** A grammar that restricts decoding to the supplied single-letter labels. */
export function grammarFor(labels: string[]): string {
  return `root ::= ${labels.map((label) => `"${label}"`).join(" | ")}`;
}

export function softmax(values: number[]): number[] {
  const maximum = Math.max(...values);
  const exponents = values.map((value) => Math.exp(value - maximum));
  const total = exponents.reduce((sum, value) => sum + value, 0);
  return exponents.map((value) => value / total);
}

/**
 * Index of the largest value, with ties going to the earlier entry, or `-1` for
 * an empty list.
 *
 * Both readout paths pick their winner through this: the generation when it
 * validates its probabilities, the direct path when the case table reads the
 * top option out of the scores. One rule, so the two cannot disagree.
 */
export function maxIndex(values: readonly number[]): number {
  let best = -1;
  for (const [index, value] of values.entries()) {
    if (best === -1 || value > values[best]) best = index;
  }
  return best;
}

/**
 * Pull the log-probability of each option letter out of the first generated
 * token. Models differ in whether they expose the letter as text or as a single
 * byte, so both encodings are accepted.
 */
export function readOptionLogprobs(response: ChatCompletionResponse, labels: string[]): number[] {
  const entries = response.choices?.[0]?.logprobs?.content?.[0]?.top_logprobs ?? [];
  return labels.map((label) => {
    const ascii = label.charCodeAt(0);
    const entry = entries.find(
      (item) => item.token === label || (item.bytes?.length === 1 && item.bytes[0] === ascii),
    );
    return Number(entry?.logprob);
  });
}

export function assertValidOptionLogprobs(values: number[], labels: string[]): void {
  if (
    !values ||
    values.length !== labels.length ||
    values.some((value) => !Number.isFinite(value))
  ) {
    throw new Error(`The model did not return valid option logits for ${labels.join(", ")}.`);
  }
}

export function expectedKeys(input: DecisionInput): string[] {
  const labels = optionLabels(input.options.length);
  return input.options.map((option, index) => `${labels[index]}: ${option}`);
}

/** Keys the generation path must produce, in the order the options were given. */
export function validateGeneration(text: string, input: DecisionInput): GenerationVerdict {
  const { payload, strippedFence } = extractJsonPayload(text);
  try {
    const parsed: unknown = JSON.parse(payload);
    const labels = optionLabels(input.options.length);
    const keys = expectedKeys(input);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("expected one JSON object");
    }
    const record = parsed as Record<string, unknown>;
    const actualKeys = Object.keys(record);
    if (actualKeys.length !== keys.length || !keys.every((key) => actualKeys.includes(key))) {
      throw new Error("expected one probability for every exact option key");
    }
    const probabilities = keys.map((key) => {
      const probability = record[key];
      if (
        typeof probability !== "number" ||
        !Number.isFinite(probability) ||
        probability < 0 ||
        probability > 1
      ) {
        throw new Error("probabilities must be numbers from 0 to 1");
      }
      return probability;
    });
    const total = probabilities.reduce((sum, value) => sum + value, 0);
    if (Math.abs(total - 1) > 0.02) throw new Error("probabilities must sum to 1");
    const index = maxIndex(probabilities);
    return {
      valid: true,
      choice: labels[index],
      choiceDescription: input.options[index],
      validationError: "",
      strippedFence,
    };
  } catch (error) {
    return {
      valid: false,
      choice: null,
      choiceDescription: null,
      validationError: error instanceof Error ? error.message : "invalid JSON",
      strippedFence,
    };
  }
}

/**
 * Guard for a runnable decision. Returns a message to show, or `null` when the
 * input is usable.
 */
export function validateDecisionInput(input: DecisionInput): string | null {
  if (!input.state || !input.question || input.options.some((option) => !option)) {
    return "State, question and every option must be nonempty.";
  }
  if (input.options.length < MIN_OPTIONS || input.options.length > MAX_OPTIONS) {
    return `This lab requires ${MIN_OPTIONS} to ${MAX_OPTIONS} options.`;
  }
  return null;
}
