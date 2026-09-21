import { LoaderCircle, Play } from "lucide-react";

import { OptionEditor } from "@/components/app/OptionEditor";
import { SectionHeading } from "@/components/app/SectionHeading";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PRESETS, type DecisionPreset } from "@/lib/presets";
import { READOUT_RUN_LABEL, type ReadoutMode } from "@/lib/readout";

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
}: WorkbenchProps) {
  return (
    <Card className="gap-0 py-6">
      <SectionHeading
        className="px-6"
        index="03"
        label="decision"
        id="workbench-title"
        title="Give it a real choice"
        description={
          readout === "both"
            ? "Both paths receive the exact same state, question and options."
            : "The selected readout receives this state, question and options."
        }
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

        <p className="text-xs leading-relaxed text-muted-foreground">
          One path reads the option probabilities directly; the other asks the model to write its
          option probabilities as JSON. Only the readout differs — the prompt, the model and the
          options are identical.
        </p>
      </CardContent>
    </Card>
  );
}
