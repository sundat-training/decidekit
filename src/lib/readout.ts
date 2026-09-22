/** Which readout paths a run computes, chosen in the setup area. */

export type ReadoutMode = "choices" | "json" | "both";

export const READOUT_MODES = ["choices", "json", "both"] as const;

export const READOUT_LABEL: Record<ReadoutMode, string> = {
  choices: "Choices only",
  json: "JSON only",
  both: "Both",
};

export const READOUT_HINT: Record<ReadoutMode, string> = {
  choices:
    "One constrained forward pass. It never decodes a token, so there is no JSON stream and nothing to validate.",
  json: "The model writes the distribution token by token. Slower, and the output can fail validation.",
  both: "The direct readout runs first, then the generation, and the two wall times are compared.",
};

/** Noun for the run button, e.g. `run the choices`. */
export const READOUT_RUN_LABEL: Record<ReadoutMode, string> = {
  choices: "run the choices",
  json: "run the json",
  both: "run both methods",
};

export function isReadoutMode(value: string): value is ReadoutMode {
  return (READOUT_MODES as readonly string[]).includes(value);
}

/** True when the mode computes the direct logit readout. */
export function includesChoices(mode: ReadoutMode): boolean {
  return mode !== "json";
}

/** True when the mode computes the JSON generation. */
export function includesJson(mode: ReadoutMode): boolean {
  return mode !== "choices";
}

/**
 * True when both paths run, i.e. when their wall times can be compared. Derived
 * from the two predicates above rather than from the mode's name, so a new mode
 * cannot end up claiming a comparison it does not offer.
 */
export function isComparison(mode: ReadoutMode): boolean {
  return includesChoices(mode) && includesJson(mode);
}
