import { memo } from "react";

import { SectionHeading } from "@/components/app/SectionHeading";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Case, CaseOutcome } from "@/lib/cases";
import { maxIndex } from "@/lib/decision";
import { formatRatio, formatSeconds } from "@/lib/format";
import { includesChoices, includesJson, type ReadoutMode } from "@/lib/readout";

export interface CasesResultsProps {
  cases: Case[];
  outcomes: CaseOutcome[];
  /** The case in flight, or null while nothing runs. */
  runningId: string | null;
  readout: ReadoutMode;
}

/** The highest scored option, which is the answer the run reports. */
function choiceCell(outcome: CaseOutcome | undefined, running: boolean): string {
  if (!outcome) return running ? "running…" : "—";
  const scores = outcome.direct?.options ?? [];
  const index = maxIndex(scores.map((option) => option.probability));
  if (index === -1) return "—";
  const top = scores[index];
  return `${top.label} · ${top.probability.toFixed(3)}`;
}

function jsonCell(outcome: CaseOutcome | undefined, running: boolean): string {
  if (!outcome) return running ? "running…" : "—";
  const generation = outcome.generation;
  if (!generation) return "—";
  const answer = generation.valid ? generation.choice : "unusable";
  return `${answer} · ${formatSeconds(generation.generationMs)}`;
}

function ratioCell(outcome: CaseOutcome | undefined): string {
  return (
    formatRatio(outcome?.direct?.totalMs ?? null, outcome?.generation?.generationMs ?? null) ?? "—"
  );
}

function jsonDetail(outcome: CaseOutcome | undefined): string | undefined {
  const generation = outcome?.generation;
  if (!generation || generation.valid) return undefined;
  return `unusable output · ${generation.validationError}`;
}

/**
 * Memoized: the run state changes on every streamed token, but a table row only
 * changes when a case finishes. The props are replaced rather than mutated, so
 * a shallow comparison is enough to keep the rows out of that loop.
 */
export const CasesResults = memo(function CasesResults({
  cases,
  outcomes,
  runningId,
  readout,
}: CasesResultsProps) {
  const showChoices = includesChoices(readout);
  const showJson = includesJson(readout);
  const showRatio = showChoices && showJson;
  const byId = new Map(outcomes.map((outcome) => [outcome.id, outcome]));

  return (
    <Card className="gap-0 py-6">
      {/* A plain block, not CardHeader: its `sm:flex-row` would shrink the
          heading to its content and the progress badge would lose its edge. */}
      <div className="px-6 pb-4">
        <SectionHeading
          index="03"
          label="results"
          title="Cases"
          eyebrowAction={
            <Badge variant="outline" data-testid="cases-progress">
              {outcomes.length} / {cases.length}
            </Badge>
          }
        />
      </div>

      <CardContent className="px-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>case</TableHead>
              {showChoices ? <TableHead>choices</TableHead> : null}
              {showJson ? <TableHead>json</TableHead> : null}
              {showRatio ? <TableHead>ratio</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.map((entry) => {
              const outcome = byId.get(entry.id);
              const running = entry.id === runningId;
              return (
                <TableRow key={entry.id} data-testid="case-result-row">
                  <TableCell className="font-mono text-xs">{entry.id}</TableCell>
                  {showChoices ? (
                    <TableCell
                      className="font-mono text-xs"
                      data-testid={`case-choices-${entry.id}`}
                    >
                      {choiceCell(outcome, running)}
                    </TableCell>
                  ) : null}
                  {showJson ? (
                    <TableCell
                      className="font-mono text-xs"
                      title={jsonDetail(outcome)}
                      data-testid={`case-json-${entry.id}`}
                    >
                      {jsonCell(outcome, running)}
                    </TableCell>
                  ) : null}
                  {showRatio ? (
                    <TableCell className="font-mono text-xs">{ratioCell(outcome)}</TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
});
