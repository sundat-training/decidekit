import { Link } from "react-router";

import { MethodMap } from "@/components/app/MethodMap";
import { ResultsSection } from "@/components/app/Results";
import { SetupPanel } from "@/components/app/SetupPanel";
import { VerdictBar } from "@/components/app/VerdictBar";
import { Workbench } from "@/components/app/Workbench";
import { useLab } from "@/hooks/useLab";
import { formatSeconds } from "@/lib/format";

export function Lab() {
  const lab = useLab();
  const { inference, model } = lab;
  const result = inference.result;

  const ratio = result
    ? `${(result.generationMs / result.directMs).toFixed(2)}× generation / direct`
    : "run it on your GPU";

  const note = result
    ? `Measured sequentially in this tab. Direct: ${formatSeconds(result.directMs)}. Generation: ${formatSeconds(result.generationMs)}. The order is fixed and the model was warmed before both.`
    : "The methods run sequentially on the same loaded model so they never contend for one GPU. Direct runs first, then generation.";

  return (
    <>
      <SetupPanel
        selected={lab.modelId}
        onSelect={lab.selectModel}
        onLoad={() => inference.loadModel(lab.modelId, lab.useLocal)}
        headingLevel={1}
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
        state={lab.state}
        question={lab.question}
        options={lab.options}
        onStateChange={lab.setState}
        onQuestionChange={lab.setQuestion}
        onOptionsChange={lab.setOptions}
        onApplyPreset={lab.applyPreset}
        onRun={lab.run}
        canRun={inference.canRun}
        running={lab.running}
      />

      <MethodMap modelShort={model.short} optionCount={lab.options.length} />

      <ResultsSection
        direct={inference.direct}
        stream={inference.stream}
        result={result}
        running={lab.running}
      />

      <p className="text-xs leading-relaxed text-muted-foreground">
        Direct scores are conditional on the displayed options and are not calibrated confidence.{" "}
        <Link className="underline underline-offset-4 hover:text-foreground" to="/about">
          How to read these numbers
        </Link>
      </p>

      <VerdictBar ratio={ratio} note={note} />
    </>
  );
}
