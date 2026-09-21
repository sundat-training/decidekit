import { ArrowRight, Braces, Binary } from "lucide-react";

export interface MethodMapProps {
  modelShort: string;
  optionCount: number;
}

/**
 * A quiet schematic of the shared prefix and the fork: one prompt, one loaded
 * model, two readout paths.
 */
export function MethodMap({ modelShort, optionCount }: MethodMapProps) {
  const lastLabel = String.fromCharCode(64 + Math.min(optionCount, 20));

  return (
    <section
      aria-label="The two decision paths"
      className="grid divide-y divide-border overflow-hidden rounded-xl border border-border bg-card md:grid-cols-[1fr_auto_1fr] md:divide-x md:divide-y-0"
    >
      <div className="flex flex-col gap-1 p-5">
        <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
          input
        </span>
        <span className="text-sm font-medium">state · question · options</span>
      </div>

      <div className="hidden items-center justify-center px-4 md:flex">
        <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
      </div>

      <div className="flex flex-col gap-1 p-5">
        <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
          one loaded model
        </span>
        <span className="text-sm font-medium">{modelShort}</span>
      </div>

      <div className="grid gap-px bg-border md:col-span-3 md:grid-cols-2">
        <div className="flex items-center gap-3 bg-card p-5">
          <Binary className="size-4 text-direct" aria-hidden="true" />
          <span className="flex flex-col">
            <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
              read logits
            </span>
            <span className="text-sm font-medium">A…{lastLabel} probabilities</span>
          </span>
        </div>
        <div className="flex items-center gap-3 bg-card p-5">
          <Braces className="size-4 text-generation" aria-hidden="true" />
          <span className="flex flex-col">
            <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
              write tokens
            </span>
            <span className="text-sm font-medium">{"{ options + probabilities }"}</span>
          </span>
        </div>
      </div>
    </section>
  );
}
