import { memo, type ReactNode } from "react";

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
import type { ScoredOption } from "@/lib/decision";
import { formatRatio, formatSecondsOrDash, NOT_MEASURED } from "@/lib/format";
import { includesChoices, includesJson, isComparison, type ReadoutMode } from "@/lib/readout";
import {
  batchDurationMs,
  caseDurationMs,
  choiceScores,
  durationDetail,
  generationScores,
  splitDistribution,
} from "@/lib/results";
import { cn } from "@/lib/utils";

export interface CasesResultsProps {
  cases: Case[];
  outcomes: CaseOutcome[];
  /** The case in flight, or null while nothing runs. */
  runningId: string | null;
  readout: ReadoutMode;
}

/**
 * The answer leads: its label carries the path's colour, its option text and its
 * value follow. Every other option stays visible but recedes to a single dim
 * line of labels and values.
 */
function Distribution({
  scores,
  tone,
  fallback,
}: {
  scores: ScoredOption[];
  tone: "direct" | "generation";
  fallback: ReactNode;
}) {
  const split = splitDistribution(scores);
  if (!split) return <>{fallback}</>;

  return (
    <div className="flex flex-col gap-0.5 whitespace-nowrap">
      <span className="flex items-baseline gap-2">
        <span
          className={cn(
            "font-mono text-sm font-semibold",
            tone === "direct" ? "text-direct" : "text-generation",
          )}
        >
          {split.lead.label}
        </span>
        <span className="max-w-[13rem] truncate text-xs" title={split.lead.description}>
          {split.lead.description}
        </span>
        <span className="metric-value font-mono text-sm font-medium">
          {split.lead.probability.toFixed(3)}
        </span>
      </span>

      {split.rest.length > 0 ? (
        <span className="flex flex-wrap gap-x-3 font-mono text-[10px] text-muted-foreground">
          {split.rest.map((option) => (
            <span key={option.label} title={option.description}>
              {option.label} {option.probability.toFixed(3)}
            </span>
          ))}
        </span>
      ) : null}
    </div>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="font-mono text-xs text-muted-foreground">{children}</span>;
}

/** The placeholder of a cell whose case has not produced a value yet. */
function Pending({ running }: { running: boolean }) {
  return <Muted>{running ? "running…" : NOT_MEASURED}</Muted>;
}

/** Says why the generation produced no distribution, without hiding it. */
function unusable(outcome: CaseOutcome | undefined, running: boolean) {
  if (!outcome) return <Pending running={running} />;
  const generation = outcome.generation;
  if (!generation) return <Muted>{NOT_MEASURED}</Muted>;
  return (
    <span className="flex flex-col gap-0.5">
      <span className="font-mono text-xs text-destructive">unusable</span>
      <span className="max-w-[16rem] text-[10px] text-muted-foreground">
        {generation.validationError}
      </span>
    </span>
  );
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
  const showRatio = isComparison(readout);
  const byId = new Map(outcomes.map((outcome) => [outcome.id, outcome]));
  const totalMs = batchDurationMs(outcomes);

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
              {/* Left-aligned like their cells: `TableHead` right-aligns by
                  default, which would float these labels over the far edge. */}
              {showChoices ? (
                <TableHead className="text-left" data-testid="case-head-choices">
                  choices
                </TableHead>
              ) : null}
              {showJson ? <TableHead className="text-left">json</TableHead> : null}
              {showRatio ? <TableHead>ratio</TableHead> : null}
              <TableHead>time</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {cases.map((entry) => {
              const outcome = byId.get(entry.id);
              const running = entry.id === runningId;
              const ms = caseDurationMs(outcome);
              return (
                <TableRow key={entry.id} data-testid="case-result-row">
                  <TableCell
                    className="align-top font-mono text-xs"
                    data-testid={`case-id-${entry.id}`}
                  >
                    {entry.id}
                  </TableCell>

                  {showChoices ? (
                    <TableCell
                      className="text-left align-top"
                      data-testid={`case-choices-${entry.id}`}
                    >
                      <Distribution
                        scores={choiceScores(outcome)}
                        tone="direct"
                        fallback={<Pending running={running} />}
                      />
                    </TableCell>
                  ) : null}

                  {showJson ? (
                    <TableCell
                      className="text-left align-top"
                      data-testid={`case-json-${entry.id}`}
                    >
                      <Distribution
                        scores={generationScores(entry, outcome)}
                        tone="generation"
                        fallback={unusable(outcome, running)}
                      />
                    </TableCell>
                  ) : null}

                  {showRatio ? (
                    <TableCell className="align-top font-mono text-xs">
                      {formatRatio(
                        outcome?.direct?.totalMs ?? null,
                        outcome?.generation?.generationMs ?? null,
                      ) ?? NOT_MEASURED}
                    </TableCell>
                  ) : null}

                  <TableCell
                    className="metric-value align-top font-mono text-xs"
                    title={durationDetail(outcome)}
                    data-testid={`case-time-${entry.id}`}
                  >
                    {formatSecondsOrDash(ms)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>

          <tfoot>
            <TableRow className="border-t-2 border-border">
              <TableHead
                scope="row"
                className="py-2.5 text-[11px] tracking-[0.14em]"
                data-testid="cases-total"
              >
                total
              </TableHead>
              {showChoices ? <TableHead /> : null}
              {showJson ? <TableHead /> : null}
              {showRatio ? <TableHead /> : null}
              {/* A cell, not a head: the unit must keep its lower case. */}
              <TableCell
                className="metric-value py-2.5 font-mono text-xs"
                data-testid="cases-total-value"
              >
                {formatSecondsOrDash(totalMs)}
              </TableCell>
            </TableRow>
          </tfoot>
        </Table>
      </CardContent>
    </Card>
  );
});
