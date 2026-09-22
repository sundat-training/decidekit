import { useCallback, useMemo, useState } from "react";

import { normalizeDecisionInput, type DecisionInput } from "@/lib/decision";
import { DEFAULT_DECISION, type DecisionPreset } from "@/lib/presets";

export interface DecisionEditor {
  state: string;
  question: string;
  options: string[];
  setState: (value: string) => void;
  setQuestion: (value: string) => void;
  setOptions: (options: string[]) => void;
  applyPreset: (preset: DecisionPreset) => void;
  /** The fields as a run needs them: trimmed, and the same shape a file yields. */
  input: DecisionInput;
}

/**
 * The decision the visitor phrases by hand, which is what a run uses while no
 * case file is loaded.
 *
 * The fields are positional in the same way the case file's are, and the preset
 * only prefills them; nothing here knows about the worker.
 */
export function useDecisionEditor(): DecisionEditor {
  const [state, setState] = useState(DEFAULT_DECISION.state);
  const [question, setQuestion] = useState(DEFAULT_DECISION.question);
  const [options, setOptions] = useState<string[]>(DEFAULT_DECISION.options);

  const applyPreset = useCallback((preset: DecisionPreset) => {
    setState(preset.state);
    setQuestion(preset.question);
    setOptions([...preset.options]);
  }, []);

  const input = useMemo(
    () => normalizeDecisionInput({ state, question, options }),
    [state, question, options],
  );

  return useMemo(
    () => ({ state, question, options, setState, setQuestion, setOptions, applyPreset, input }),
    [state, question, options, applyPreset, input],
  );
}
