import { CasesResults } from "@/components/app/CasesResults";
import { ResultsSection } from "@/components/app/Results";
import { SetupPanel } from "@/components/app/SetupPanel";
import { VerdictBar } from "@/components/app/VerdictBar";
import { Workbench } from "@/components/app/Workbench";
import { useLab } from "@/hooks/useLab";
import { hasCases, type CaseOutcome } from "@/lib/cases";
import { verdictRatio } from "@/lib/verdict";

/** One stable reference, so a fresh `[]` cannot defeat the table's memo. */
const NO_OUTCOMES: CaseOutcome[] = [];

export function Lab() {
  const lab = useLab();
  const { inference } = lab;
  const result = inference.result;
  // A loaded file supplies the input, so the single-decision readouts (and the
  // ratio bar that belongs to them) give way to one row per case.
  const fromFile = hasCases(lab.source.cases);

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
        canLoad={inference.canLoad}
        loading={inference.busy === "load"}
        modelReady={inference.modelReady}
        loadedModelId={inference.loadedModelId}
        failedModelId={inference.failedModelId}
        cachedTiers={inference.cachedTiers}
        busy={inference.busy !== null}
        download={inference.download}
        loadMs={inference.loadMs}
        warmupMs={inference.warmupMs}
        support={inference.support}
      />

      <Workbench
        state={lab.editor.state}
        question={lab.editor.question}
        options={lab.editor.options}
        onStateChange={lab.editor.setState}
        onQuestionChange={lab.editor.setQuestion}
        onOptionsChange={lab.editor.setOptions}
        onApplyPreset={lab.editor.applyPreset}
        onRun={lab.run}
        canRun={inference.canRun}
        running={lab.running}
        readout={lab.readout}
        cases={lab.source.cases}
        caseFileName={lab.source.fileName}
        caseFileError={lab.source.error}
        runningCaseId={inference.batch?.runningId ?? null}
        onLoadCaseFile={(file) => {
          void lab.source.loadFile(file);
        }}
        onClearCases={lab.source.clear}
      />

      {fromFile ? (
        <CasesResults
          cases={lab.source.cases}
          outcomes={inference.batch?.outcomes ?? NO_OUTCOMES}
          runningId={inference.batch?.runningId ?? null}
          readout={lab.readout}
          liveDirect={inference.direct}
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
