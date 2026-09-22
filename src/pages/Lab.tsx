import { ResultsSection } from "@/components/app/Results";
import { SetupPanel } from "@/components/app/SetupPanel";
import { VerdictBar } from "@/components/app/VerdictBar";
import { Workbench } from "@/components/app/Workbench";
import { useLab } from "@/hooks/useLab";
import { describeVerdict } from "@/lib/verdict";

export function Lab() {
  const lab = useLab();
  const { inference } = lab;
  const result = inference.result;

  const verdict = describeVerdict({
    readout: lab.readout,
    directMs: inference.direct?.totalMs ?? null,
    generationMs: result?.generationMs ?? null,
    generatedTokens: result?.generatedTokens ?? null,
  });

  return (
    <>
      <SetupPanel
        selected={lab.modelId}
        onSelect={lab.selectModel}
        onLoad={() => inference.loadModel(lab.modelId, lab.useLocal)}
        readout={lab.readout}
        onReadoutChange={lab.setReadout}
        headingLevel={1}
        open={lab.setupOpen}
        onToggleOpen={lab.toggleSetup}
        webgpuOk={inference.webgpuOk}
        canLoad={inference.canLoad}
        loading={inference.busy === "load"}
        modelReady={inference.modelReady}
        loadedModelId={inference.loadedModelId}
        cachedTiers={inference.cachedTiers}
        busy={inference.busy !== null}
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
        readout={lab.readout}
      />

      <ResultsSection
        direct={inference.direct}
        stream={inference.stream}
        result={result}
        running={lab.running}
        readout={lab.readout}
      />

      <VerdictBar label={verdict.label} ratio={verdict.ratio} note={verdict.note} />
    </>
  );
}
