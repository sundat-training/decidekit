import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { useCaseSource, type CaseSource } from "@/hooks/useCaseSource";
import { useDecisionEditor, type DecisionEditor } from "@/hooks/useDecisionEditor";
import { useInference, type InferenceApi } from "@/hooks/useInference";
import { useInferenceConfig } from "@/hooks/useInferenceConfig";
import { hasCases } from "@/lib/cases";
import { DEFAULT_MODEL_ID, type ModelId } from "@/lib/models";
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
  /** The decision phrased by hand, used while no file is loaded. */
  editor: DecisionEditor;
  /** The cases from a file, which replace the editor's input. */
  source: CaseSource;
  /** Which readouts the next run computes and the page displays. */
  readout: ReadoutMode;
  setReadout: (mode: ReadoutMode) => void;
  run: () => void;
  running: boolean;
  useLocal: boolean;
  /** Whether the setup details are expanded; kept here so it survives routing. */
  setupOpen: boolean;
  toggleSetup: () => void;
}

const LabContext = createContext<LabContextValue | null>(null);

/**
 * Owns the worker, the loaded model and the two possible inputs above the
 * router, so navigating to another page does not throw away a model that took
 * minutes to download and compile.
 *
 * The editor and the case file keep their own state and only meet here, in the
 * one decision a run has to make: which of the two supplies the input.
 */
export function LabProvider({ children }: { children: ReactNode }) {
  const inference = useInference(useInferenceConfig());
  const [modelId, setModelId] = useState<ModelId>(DEFAULT_MODEL_ID);
  const editor = useDecisionEditor();
  const source = useCaseSource(inference.resetRun);
  const [readout, setReadout] = useState<ReadoutMode>("choices");
  const [useLocal] = useState(readLocalAssetsFlag);
  const [setupOpen, setSetupOpen] = useState(true);

  const toggleSetup = useCallback(() => setSetupOpen((current) => !current), []);

  const run = useCallback(() => {
    if (hasCases(source.cases)) {
      inference.runCases(source.cases, readout);
      return;
    }
    inference.runComparison(editor.input, readout);
  }, [inference, editor.input, source.cases, readout]);

  const value = useMemo<LabContextValue>(
    () => ({
      inference,
      modelId,
      selectModel: setModelId,
      editor,
      source,
      readout,
      setReadout,
      run,
      running: inference.busy === "run",
      useLocal,
      setupOpen,
      toggleSetup,
    }),
    [inference, modelId, editor, source, readout, run, useLocal, setupOpen, toggleSetup],
  );

  return <LabContext.Provider value={value}>{children}</LabContext.Provider>;
}

export function useLab(): LabContextValue {
  const value = useContext(LabContext);
  if (!value) throw new Error("useLab must be used inside a LabProvider.");
  return value;
}
