import { CasesResults } from "@/components/app/CasesResults";
import { ResultsSection } from "@/components/app/Results";
import { SetupPanel } from "@/components/app/SetupPanel";
import { VerdictBar } from "@/components/app/VerdictBar";
import { Workbench } from "@/components/app/Workbench";
import { useLab } from "@/hooks/useLab";
import { verdictRatio } from "@/lib/verdict";

export function Lab() {
  const lab = useLab();
  const { inference } = lab;
  const result = inference.result;
  // A loaded file supplies the input, so the single-decision readouts (and the
  // ratio bar that belongs to them) give way to one row per case.
  const fromFile = lab.cases.length > 0;

  const ratio = verdictRatio({
    readout: lab.readout,
    directMs: inference.direct?.totalMs ?? null,
    generationMs: result?.generationMs ?? null,
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
        cases={lab.cases}
        caseFileName={lab.caseFileName}
        caseFileError={lab.caseFileError}
        runningCaseId={inference.batch?.runningId ?? null}
        onLoadCaseFile={(file) => {
          void lab.loadCaseFile(file);
        }}
        onClearCases={lab.clearCases}
      />

      {fromFile ? (
        <CasesResults
          cases={lab.cases}
          outcomes={inference.batch?.outcomes ?? []}
          runningId={inference.batch?.runningId ?? null}
          readout={lab.readout}
        />
      ) : (
        <ResultsSection
          direct={inference.direct}
          stream={inference.stream}
          result={result}
          running={lab.running}
          readout={lab.readout}
        />
      )}

      {!fromFile && ratio !== null ? <VerdictBar ratio={ratio} /> : null}
    </>
  );
}
