import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MODELS, MODEL_IDS, PUBLISHED_BASELINE, QUALITY_NOTE, type ModelId } from "@/lib/models";
import { cn } from "@/lib/utils";

export interface ModelQualityTableProps {
  selected: ModelId;
}

export function ModelQualityTable({ selected }: ModelQualityTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex flex-col gap-1 border-b border-border px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between">
        <span className="text-sm font-medium">Reference quality</span>
        <span className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
          native checkpoints · owned + public benchmarks
        </span>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead>Model</TableHead>
            <TableHead>Download</TableHead>
            <TableHead>Authored</TableHead>
            <TableHead>Perturbed</TableHead>
            <TableHead>TypeSafe</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {MODEL_IDS.map((id) => {
            const model = MODELS[id];
            return (
              <TableRow
                key={id}
                aria-current={id === selected ? "true" : undefined}
                className={cn(
                  id === selected && "bg-direct/6 font-medium",
                  id !== selected && "text-muted-foreground",
                )}
              >
                <TableCell className="text-foreground">{model.name}</TableCell>
                <TableCell>{model.size}</TableCell>
                <TableCell>{model.quality.authored}</TableCell>
                <TableCell>{model.quality.perturbed}</TableCell>
                <TableCell>{model.quality.typeSafe}</TableCell>
              </TableRow>
            );
          })}
          <TableRow className="text-muted-foreground">
            <TableCell>{PUBLISHED_BASELINE.name}</TableCell>
            <TableCell>{PUBLISHED_BASELINE.download}</TableCell>
            <TableCell>{PUBLISHED_BASELINE.authored}</TableCell>
            <TableCell>{PUBLISHED_BASELINE.perturbed}</TableCell>
            <TableCell>{PUBLISHED_BASELINE.typeSafe}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <p className="border-t border-border px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        {QUALITY_NOTE}
      </p>
    </div>
  );
}
