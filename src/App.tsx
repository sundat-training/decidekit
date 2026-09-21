import { useMemo, useState } from "react";

import { Hero } from "@/components/app/Hero";
import { Limitations } from "@/components/app/Limitations";
import { MethodMap } from "@/components/app/MethodMap";
import { ResultsSection } from "@/components/app/Results";
import { SetupPanel } from "@/components/app/SetupPanel";
import { SiteFooter, SiteHeader } from "@/components/app/SiteChrome";
import { VerdictBar } from "@/components/app/VerdictBar";
import { Workbench } from "@/components/app/Workbench";
import { useInference, type WebGPUProbe, type WorkerFactory } from "@/hooks/useInference";
import { formatSeconds } from "@/lib/format";
import { DEFAULT_MODEL_ID, MODELS, detectSmallDevice, type ModelId } from "@/lib/models";
import { DEFAULT_DECISION, type DecisionPreset } from "@/lib/presets";

export interface AppProps {
  /** Injected in tests so the lab can run without a GPU or a real worker. */
  createWorker?: WorkerFactory;
  probe?: WebGPUProbe;
}

/** `?local` on localhost switches the loader to files under `public/assets/`. */
function useLocalAssets(): boolean {
  return useMemo(() => {
    if (typeof location === "undefined") return false;
    return (
      ["127.0.0.1", "localhost"].includes(location.hostname) &&
      new URLSearchParams(location.search).has("local")
    );
  }, []);
}

export function App({ createWorker, probe }: AppProps) {
  const inference = useInference({ createWorker, probe });
  const [modelId, setModelId] = useState<ModelId>(DEFAULT_MODEL_ID);
  const [state, setState] = useState(DEFAULT_DECISION.state);
  const [question, setQuestion] = useState(DEFAULT_DECISION.question);
  const [options, setOptions] = useState<string[]>(DEFAULT_DECISION.options);
  const useLocal = useLocalAssets();
  const smallDevice = useMemo(() => detectSmallDevice(), []);

  const model = MODELS[modelId];
  const running = inference.busy === "run";
  const result = inference.result;

  const deviceNote = smallDevice
    ? `Small device detected · ${model.name} is selected. Switch to Qwen3 0.6B in the setup panel if loading is too heavy.`
    : `Desktop detected · ${model.name} is selected by default.`;

  const ratio = result
    ? `${(result.generationMs / result.directMs).toFixed(2)}× generation / direct`
    : "run it on your GPU";

  const note = result
    ? `Measured sequentially in this tab. Direct: ${formatSeconds(result.directMs)}. Generation: ${formatSeconds(result.generationMs)}. The order is fixed and the model was warmed before both.`
    : "The methods run sequentially on the same loaded model so they never contend for one GPU. Direct runs first, then generation.";

  function applyPreset(preset: DecisionPreset) {
    setState(preset.state);
    setQuestion(preset.question);
    setOptions([...preset.options]);
  }

  function run() {
    inference.runComparison({
      state: state.trim(),
      question: question.trim(),
      options: options.map((option) => option.trim()),
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 pt-6 pb-24 sm:px-8">
      <SiteHeader />

      <Hero modelSize={model.size} deviceNote={deviceNote} />

      <SetupPanel
        selected={modelId}
        onSelect={setModelId}
        onLoad={() => inference.loadModel(modelId, useLocal)}
        webgpuOk={inference.webgpuOk}
        canLoad={inference.canLoad}
        loading={inference.busy === "load"}
        modelReady={inference.modelReady}
        selectDisabled={inference.busy !== null || inference.modelReady}
        download={inference.download}
        loadMs={inference.loadMs}
        warmupMs={inference.warmupMs}
        support={inference.support}
      />

      <Workbench
        state={state}
        question={question}
        options={options}
        onStateChange={setState}
        onQuestionChange={setQuestion}
        onOptionsChange={setOptions}
        onApplyPreset={applyPreset}
        onRun={run}
        canRun={inference.canRun}
        running={running}
      />

      <MethodMap modelShort={model.short} optionCount={options.length} />

      <ResultsSection
        direct={inference.direct}
        stream={inference.stream}
        result={result}
        running={running}
      />

      <VerdictBar ratio={ratio} note={note} />

      <Limitations />

      <SiteFooter modelRepo={model.repo} />
    </main>
  );
}
