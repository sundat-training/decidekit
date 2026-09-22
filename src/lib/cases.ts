/**
 * The case file contract.
 *
 * A run is a list of cases rather than a single decision: the editor produces a
 * batch of one, and a JSON file can supply many. Every case carries a `type` so
 * that later experiments can be added without changing the file or the runner —
 * `decision` is the only type that exists today, and it is the default.
 *
 * Nothing here touches the DOM, the worker or WebGPU, so a file can be checked
 * before a model is loaded and without a GPU.
 */

import { normalizeDecisionInput, validateDecisionInput, type DecisionInput } from "./decision";
import type { DirectResult, GenerationResult } from "./inference/protocol";

/** Case types this build can run. */
export const CASE_TYPES = ["decision"] as const;

export type CaseType = (typeof CASE_TYPES)[number];

export interface Case {
  /** Stable label for the row, unique within a file. */
  id: string;
  type: CaseType;
  input: DecisionInput;
}

/** What one case produced; a skipped path stays null. */
export interface CaseOutcome {
  id: string;
  direct: DirectResult | null;
  generation: GenerationResult | null;
}

export type CaseFileResult = { ok: true; cases: Case[] } | { ok: false; error: string };

/**
 * Whether a loaded file supplies the input. One predicate, because three places
 * depend on it: the run picks its source, the workbench swaps the editor for the
 * list, and the lab swaps the lanes for the table.
 */
export function hasCases(cases: readonly Case[]): boolean {
  return cases.length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isCaseType(value: string): value is CaseType {
  return (CASE_TYPES as readonly string[]).includes(value);
}

function readDecisionInput(input: Record<string, unknown>, where: string): DecisionInput | string {
  const { state, question, options } = input;
  if (typeof state !== "string" || typeof question !== "string" || !Array.isArray(options)) {
    return `${where} needs a string state, a string question and an array of options.`;
  }
  if (!options.every((option): option is string => typeof option === "string")) {
    return `${where}.options must all be strings.`;
  }

  const decision = normalizeDecisionInput({ state, question, options });
  const problem = validateDecisionInput(decision);
  return problem ? `${where}: ${problem}` : decision;
}

/** Reads one entry. Returns the case, or a message that names the problem. */
function readCase(entry: unknown, index: number, seen: Set<string>): Case | string {
  const where = `cases[${index}]`;
  if (!isRecord(entry)) return `${where} must be an object.`;

  const type = entry.type ?? "decision";
  if (typeof type !== "string" || !isCaseType(type)) {
    return `${where}.type must be one of: ${CASE_TYPES.join(", ")}.`;
  }

  const rawId = entry.id ?? `${type} ${index + 1}`;
  if (typeof rawId !== "string" || rawId.trim() === "") {
    return `${where}.id must be a nonempty string when given.`;
  }
  const id = rawId.trim();
  if (seen.has(id)) return `The case id ${JSON.stringify(id)} is used more than once.`;
  seen.add(id);

  if (!isRecord(entry.input)) return `${where}.input must be an object.`;
  const input = readDecisionInput(entry.input, `${where}.input`);
  if (typeof input === "string") return input;

  return { id, type, input };
}

/**
 * Strict at the edges and quiet in the middle: one unknown key is ignored, but
 * a missing one, a wrong type or an empty value is reported with its path.
 */
export function parseCaseFile(text: string): CaseFileResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `The file is not valid JSON: ${detail}` };
  }

  if (!isRecord(parsed)) return { ok: false, error: "The file must hold one JSON object." };
  if (!Array.isArray(parsed.cases))
    return { ok: false, error: 'The object needs a "cases" array.' };
  if (parsed.cases.length === 0) {
    return { ok: false, error: '"cases" must hold at least one case.' };
  }

  const seen = new Set<string>();
  const cases: Case[] = [];
  for (const [index, entry] of parsed.cases.entries()) {
    const result = readCase(entry, index, seen);
    if (typeof result === "string") return { ok: false, error: result };
    cases.push(result);
  }
  return { ok: true, cases };
}
