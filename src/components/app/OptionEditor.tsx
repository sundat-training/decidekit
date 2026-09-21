import { Minus, Plus } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_OPTIONS, MIN_OPTIONS, optionLabels } from "@/lib/labels";

export interface OptionEditorProps {
  options: string[];
  onChange: (options: string[]) => void;
}

/**
 * Between two and twenty options. The letters are derived from position, so the
 * UI never has to keep a label and an option in sync by hand.
 */
export function OptionEditor({ options, onChange }: OptionEditorProps) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const labels = optionLabels(options.length);
  const atMax = options.length >= MAX_OPTIONS;
  const atMin = options.length <= MIN_OPTIONS;

  function addOption() {
    if (atMax) return;
    const next = [...options, ""];
    onChange(next);
    requestAnimationFrame(() => inputs.current[next.length - 1]?.focus());
  }

  function removeOption() {
    if (atMin) return;
    onChange(options.slice(0, -1));
  }

  function setOption(index: number, value: string) {
    onChange(options.map((option, position) => (position === index ? value : option)));
  }

  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <legend className="px-1 text-sm font-medium">Allowed options</legend>

      <div className="flex flex-col gap-2">
        {options.map((option, index) => (
          // Options are a positional list: the letter is derived from the index,
          // so the index is the stable identity of a row.
          // oxlint-disable-next-line react/no-array-index-key
          <div key={index} className="flex items-center gap-3" data-testid="option-row">
            <span
              className="w-4 shrink-0 font-mono text-xs text-muted-foreground"
              aria-hidden="true"
            >
              {labels[index]}
            </span>
            <Input
              ref={(node) => {
                inputs.current[index] = node;
              }}
              value={option}
              onChange={(event) => setOption(index, event.target.value)}
              placeholder="Describe this option"
              aria-label={`Option ${labels[index]}`}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
        <Button variant="outline" size="sm" onClick={removeOption} disabled={atMin}>
          <Minus aria-hidden="true" />
          remove
        </Button>
        <span
          className="metric-value font-mono text-xs text-muted-foreground"
          data-testid="option-count"
        >
          {options.length} / {MAX_OPTIONS}
        </span>
        <Button variant="outline" size="sm" onClick={addOption} disabled={atMax}>
          <Plus aria-hidden="true" />
          add
        </Button>
      </div>
    </fieldset>
  );
}
