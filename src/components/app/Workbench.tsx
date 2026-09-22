import { LoaderCircle, Play } from "lucide-react";
import type { ChangeEvent } from "react";

import { OptionEditor } from "@/components/app/OptionEditor";
import { SectionHeading } from "@/components/app/SectionHeading";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { hasCases, type Case } from "@/lib/cases";
import { pluralize } from "@/lib/format";
import { PRESETS, type DecisionPreset } from "@/lib/presets";
import { READOUT_RUN_LABEL, type ReadoutMode } from "@/lib/readout";
import { cn } from "@/lib/utils";

export interface WorkbenchProps {
  state: string;
  question: string;
  options: string[];
  onStateChange: (value: string) => void;
  onQuestionChange: (value: string) => void;
  onOptionsChange: (options: string[]) => void;
  onApplyPreset: (preset: DecisionPreset) => void;
  onRun: () => void;
  canRun: boolean;
  running: boolean;
  readout: ReadoutMode;
  /** Cases from a file. While any are loaded, they replace the editor. */
  cases: Case[];
  caseFileName: string | null;
  caseFileError: string | null;
  /** The case in flight, so the list can mark it. */
  runningCaseId: string | null;
  onLoadCaseFile: (file: File) => void;
  onClearCases: () => void;
}

export function Workbench({
  state,
  question,
  options,
  onStateChange,
  onQuestionChange,
  onOptionsChange,
  onApplyPreset,
  onRun,
  canRun,
  running,
  readout,
  cases,
  caseFileName,
  caseFileError,
  runningCaseId,
  onLoadCaseFile,
  onClearCases,
}: WorkbenchProps) {
  const fromFile = hasCases(cases);

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset first: picking the same file again must still count as a change.
    event.target.value = "";
    if (file) onLoadCaseFile(file);
  }

  return (
    <Card className="gap-0 py-6">
      <SectionHeading
        className="px-6"
        index="03"
        label="decision"
        id="workbench-title"
        title="Give it a real choice"
        actions={
          <Button onClick={onRun} disabled={!canRun} data-testid="run">
            {running ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Play aria-hidden="true" />
            )}
            {running ? "running…" : READOUT_RUN_LABEL[readout]}
          </Button>
        }
      />

      <CardContent className="flex flex-col gap-5 pt-5">
        {fromFile ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono text-xs text-muted-foreground">
                <span data-testid="case-file-name">{caseFileName}</span>
                {" · "}
                <span data-testid="case-count">{pluralize(cases.length, "case")}</span>
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={onClearCases}
                disabled={running}
                data-testid="clear-cases"
              >
                use the editor
              </Button>
            </div>
            <ul className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto" data-testid="case-list">
              {cases.map((entry) => (
                <li
                  key={entry.id}
                  data-testid="case-chip"
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 font-mono text-[11px]",
                    entry.id === runningCaseId
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {entry.id}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                try an example
              </span>
              {PRESETS.map((preset) => (
                <Button
                  key={preset.id}
                  variant="outline"
                  size="sm"
                  onClick={() => onApplyPreset(preset)}
                  data-testid={`preset-${preset.id}`}
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            <div className="grid gap-5 md:grid-cols-[1.3fr_1fr]">
              <div className="flex flex-col gap-1.5 md:row-span-2">
                <Label htmlFor="state">State</Label>
                <Textarea
                  id="state"
                  value={state}
                  onChange={(event) => onStateChange(event.target.value)}
                  className="min-h-40 md:h-full"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="question">Question</Label>
                <Input
                  id="question"
                  value={question}
                  onChange={(event) => onQuestionChange(event.target.value)}
                />
              </div>

              <OptionEditor options={options} onChange={onOptionsChange} />
            </div>
          </>
        )}

        <div className="flex flex-col gap-2 border-t border-border pt-5">
          <Label htmlFor="case-file" className="text-muted-foreground">
            Cases file (JSON)
          </Label>
          <input
            id="case-file"
            data-testid="case-file"
            type="file"
            accept=".json,application/json"
            disabled={running}
            onChange={handleFile}
            aria-describedby="case-file-hint"
            className={cn(
              "block w-full cursor-pointer rounded-lg border border-dashed border-border px-3 py-2",
              "font-mono text-xs text-muted-foreground",
              "file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1",
              "file:font-mono file:text-xs file:text-foreground",
            )}
          />
          <p id="case-file-hint" className="font-mono text-[10px] text-muted-foreground">
            {
              '{ "cases": [ { "id": "…", "type": "decision", "input": { "state", "question", "options" } } ] }'
            }
          </p>
          {caseFileError ? (
            <p data-testid="case-file-error" className="font-mono text-xs text-destructive">
              {caseFileError}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
