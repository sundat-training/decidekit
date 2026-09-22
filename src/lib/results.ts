/**
 * Derived values for the case table.
 *
 * Both readout paths produce the same shape here — a label, an option text and a
 * probability — so a row can be built without caring which path it came from,
 * and the winner is picked by one rule for all of them.
 *
 * Nothing here reads the DOM or React state, so a row can be checked directly.
 */

import type { Case, CaseOutcome } from "@/lib/cases";
import { maxIndex } from "@/lib/decision";
import { formatSeconds } from "@/lib/format";
import type { ScoredOption } from "@/lib/inference/protocol";
import { optionLabels } from "@/lib/labels";

/** A scored distribution split at its winner. */
export interface Distribution {
  lead: ScoredOption;
  rest: ScoredOption[];
}

/**
 * Splits a distribution at its winner, keeping the remaining options in the
 * order they were given. Ties go to the earlier option, the same rule the
 * generation validates with, so the two paths cannot disagree.
 *
 * Returns null for an empty distribution, where nothing can lead.
 */
export function splitDistribution(scores: readonly ScoredOption[]): Distribution | null {
  const index = maxIndex(scores.map((option) => option.probability));
  if (index === -1) return null;
  return {
    lead: scores[index],
    rest: scores.filter((_, position) => position !== index),
  };
}

/** The direct path scores every option itself, so its scores come as they are. */
export function choiceScores(outcome: CaseOutcome | undefined): ScoredOption[] {
  return outcome?.direct?.options ?? [];
}

/**
 * The generation reports the probabilities it parsed, aligned with the options
 * of its case. That pair rebuilds the same shape the direct path returns, so an
 * unusable output — where nothing was parsed — yields no scores at all.
 */
export function generationScores(entry: Case, outcome: CaseOutcome | undefined): ScoredOption[] {
  const probabilities = outcome?.generation?.probabilities ?? [];
  const labels = optionLabels(entry.input.options.length);
  return probabilities.map((probability, index) => ({
    label: labels[index],
    description: entry.input.options[index],
    probability,
  }));
}

/** Wall time of one case: every path that ran for it. */
export function caseDurationMs(outcome: CaseOutcome | undefined): number | null {
  if (!outcome) return null;
  const times = [outcome.direct?.totalMs, outcome.generation?.generationMs].filter(
    (value): value is number => value !== undefined,
  );
  return times.length === 0 ? null : times.reduce((sum, value) => sum + value, 0);
}

/** Wall time of the whole batch, i.e. of the cases that finished. */
export function batchDurationMs(outcomes: readonly CaseOutcome[]): number {
  return outcomes.reduce((sum, outcome) => sum + (caseDurationMs(outcome) ?? 0), 0);
}

/** How one case's time splits between the paths, for a hover detail. */
export function durationDetail(outcome: CaseOutcome | undefined): string | undefined {
  if (!outcome) return undefined;
  const parts: string[] = [];
  if (outcome.direct) parts.push(`direct ${formatSeconds(outcome.direct.totalMs)}`);
  if (outcome.generation) parts.push(`json ${formatSeconds(outcome.generation.generationMs)}`);
  return parts.length === 0 ? undefined : parts.join(" · ");
}
