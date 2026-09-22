import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { useInference, type InferenceApi } from "@/hooks/useInference";
import { useInferenceConfig } from "@/hooks/useInferenceConfig";
import { parseCaseFile, type Case } from "@/lib/cases";
import { DEFAULT_MODEL_ID, type ModelId } from "@/lib/models";
import { DEFAULT_DECISION, type DecisionPreset } from "@/lib/presets";
import type { ReadoutMode } from "@/lib/readout";

/** `?local` on localhost switches the loader to files under `public/assets/`. */
function readLocalAssetsFlag(): boolean {
  if (typeof location === "undefined") return false;
  return (
    ["127.0.0.1", "localhost"].includes(location.hostname) &&
    new URLSearchParams(location.search).has("local")
  );
}

export interface LabContextValue {
  inference: InferenceApi;
  modelId: ModelId;
  selectModel: (id: ModelId) => void;
  state: string;
  question: string;
  options: string[];
  setState: (value: string) => void;
  setQuestion: (value: string) => void;
  setOptions: (options: string[]) => void;
  applyPreset: (preset: DecisionPreset) => void;
  /** Which readouts the next run computes and the page displays. */
  readout: ReadoutMode;
  setReadout: (mode: ReadoutMode) => void;
  /** Cases loaded from a JSON file. Empty means the editor supplies the input. */
  cases: Case[];
  /** Name of the last file an import was attempted with, or null. */
  caseFileName: string | null;
  /** Why that file was rejected, or null while it parsed. */
  caseFileError: string | null;
  loadCaseFile: (file: File) => Promise<void>;
  clearCases: () => void;
  run: () => void;
  running: boolean;
  useLocal: boolean;
  /** Whether the setup details are expanded; kept here so it survives routing. */
  setupOpen: boolean;
  toggleSetup: () => void;
}

const LabContext = createContext<LabContextValue | null>(null);

/**
 * Owns the worker, the loaded model and the editable decision above the router,
 * so navigating to another page does not throw away a model that took minutes
 * to download and compile.
 */
export function LabProvider({ children }: { children: ReactNode }) {
  const inference = useInference(useInferenceConfig());
  const [modelId, setModelId] = useState<ModelId>(DEFAULT_MODEL_ID);
  const [state, setState] = useState(DEFAULT_DECISION.state);
  const [question, setQuestion] = useState(DEFAULT_DECISION.question);
  const [options, setOptions] = useState<string[]>(DEFAULT_DECISION.options);
  const [readout, setReadout] = useState<ReadoutMode>("choices");
  const [cases, setCases] = useState<Case[]>([]);
  const [caseFileName, setCaseFileName] = useState<string | null>(null);
  const [caseFileError, setCaseFileError] = useState<string | null>(null);
  const [useLocal] = useState(readLocalAssetsFlag);
  const [setupOpen, setSetupOpen] = useState(true);

  const toggleSetup = useCallback(() => setSetupOpen((current) => !current), []);

  const applyPreset = useCallback((preset: DecisionPreset) => {
    setState(preset.state);
    setQuestion(preset.question);
    setOptions([...preset.options]);
  }, []);

  /**
   * A rejected file leaves the cases that are already loaded in place, so a
   * typo in a new file never silently empties a run the visitor prepared.
   */
  const loadCaseFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      const parsed = parseCaseFile(text);
      setCaseFileName(file.name);
      if (!parsed.ok) {
        setCaseFileError(parsed.error);
        return;
      }
      setCaseFileError(null);
      // The old readouts belong to the old input, whether it was the editor or
      // another file.
      inference.resetRun();
      setCases(parsed.cases);
    },
    [inference],
  );

  const clearCases = useCallback(() => {
    inference.resetRun();
    setCases([]);
    setCaseFileName(null);
    setCaseFileError(null);
  }, [inference]);

  const run = useCallback(() => {
    if (cases.length > 0) {
      inference.runCases(cases, readout);
      return;
    }
    inference.runComparison(
      {
        state: state.trim(),
        question: question.trim(),
        options: options.map((option) => option.trim()),
      },
      readout,
    );
  }, [inference, cases, state, question, options, readout]);

  const value = useMemo<LabContextValue>(
    () => ({
      inference,
      modelId,
      selectModel: setModelId,
      state,
      question,
      options,
      setState,
      setQuestion,
      setOptions,
      applyPreset,
      readout,
      setReadout,
      cases,
      caseFileName,
      caseFileError,
      loadCaseFile,
      clearCases,
      run,
      running: inference.busy === "run",
      useLocal,
      setupOpen,
      toggleSetup,
    }),
    [
      inference,
      modelId,
      state,
      question,
      options,
      applyPreset,
      readout,
      cases,
      caseFileName,
      caseFileError,
      loadCaseFile,
      clearCases,
      run,
      useLocal,
      setupOpen,
      toggleSetup,
    ],
  );

  return <LabContext.Provider value={value}>{children}</LabContext.Provider>;
}

export function useLab(): LabContextValue {
  const value = useContext(LabContext);
  if (!value) throw new Error("useLab must be used inside a LabProvider.");
  return value;
}
