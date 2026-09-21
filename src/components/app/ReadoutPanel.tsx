import { SectionHeading } from "@/components/app/SectionHeading";
import { Card, CardContent } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { READOUT_HINT, READOUT_LABEL, READOUT_MODES, type ReadoutMode } from "@/lib/readout";

export interface ReadoutPanelProps {
  readout: ReadoutMode;
  onReadoutChange: (mode: ReadoutMode) => void;
  disabled: boolean;
}

const OPTIONS = READOUT_MODES.map((value) => ({ value, label: READOUT_LABEL[value] }));

/**
 * The second setup section: it decides what a run spends its time on, so it
 * sits with the model, not with the results.
 */
export function ReadoutPanel({ readout, onReadoutChange, disabled }: ReadoutPanelProps) {
  return (
    <Card className="gap-0 py-6">
      <SectionHeading
        className="px-6"
        index="02"
        label="readouts"
        id="readout-title"
        title="What should run"
        description="Both paths answer the same prompt. Selecting one skips the work of the other; the model, the question and the options stay identical."
      />

      <CardContent className="flex flex-col gap-4 pt-5">
        <Segmented
          name="readout"
          legend="Results to compute and display"
          value={readout}
          options={OPTIONS}
          onChange={onReadoutChange}
          disabled={disabled}
        />

        <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">
          {READOUT_HINT[readout]}
        </p>
      </CardContent>
    </Card>
  );
}
