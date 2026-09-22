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
import { maxIndex } from "@/lib/decision";
import { formatRatio, formatSeconds } from "@/lib/format";
import { optionLabels } from "@/lib/labels";
import { includesChoices, includesJson, type ReadoutMode } from "@/lib/readout";
import { cn } from "@/lib/utils";

interface ScoredOption {
  label: string;
  description: string;
  probability: number;
}

export interface CasesResultsProps {
  cases: Case[];
  outcomes: CaseOutcome[];
  /** The case in flight, or null while nothing runs. */
  runningId: string | null;
  readout: ReadoutMode;
}

/** The direct path scores every option itself, so its scores come as they are. */
function directScores(outcome: CaseOutcome | undefined): ScoredOption[] {
  return outcome?.direct?.options ?? [];
}

/**
 * The generation writes the same distribution and reports it now, so the table
 * can show its full shape instead of only the winner the validation kept.
 */
function jsonScores(entry: Case, outcome: CaseOutcome | undefined): ScoredOption[] {
  const probabilities = outcome?.generation?.probabilities ?? [];
  const labels = optionLabels(entry.input.options.length);
  return probabilities.map((probability, index) => ({
    label: labels[index],
    description: entry.input.options[index],
    probability,
  }));
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
  const index = maxIndex(scores.map((option) => option.probability));
  if (index === -1) return <>{fallback}</>;

  const winner = scores[index];
  const rest = scores.filter((_, position) => position !== index);

  return (
    <div className="flex flex-col gap-0.5 whitespace-nowrap">
      <span className="flex items-baseline gap-2">
        <span
          className={cn(
            "font-mono text-sm font-semibold",
            tone === "direct" ? "text-direct" : "text-generation",
          )}
        >
          {winner.label}
        </span>
        <span className="max-w-[13rem] truncate text-xs" title={winner.description}>
          {winner.description}
        </span>
        <span className="metric-value font-mono text-sm font-medium">
          {winner.probability.toFixed(3)}
        </span>
      </span>

      {rest.length > 0 ? (
        <span className="flex flex-wrap gap-x-3 font-mono text-[10px] text-muted-foreground">
          {rest.map((option) => (
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

/** Says why the generation produced no distribution, without hiding it. */
function unusable(outcome: CaseOutcome | undefined, running: boolean) {
  if (!outcome) return <Muted>{running ? "running…" : "—"}</Muted>;
  const generation = outcome.generation;
  if (!generation) return <Muted>—</Muted>;
  return (
    <span className="flex flex-col gap-0.5">
      <span className="font-mono text-xs text-destructive">unusable</span>
      <span className="max-w-[16rem] text-[10px] text-muted-foreground">
        {generation.validationError}
      </span>
    </span>
  );
}

/** Wall time of one case, which is the sum of the paths that ran for it. */
function caseMs(outcome: CaseOutcome | undefined): number | null {
  if (!outcome) return null;
  const times = [outcome.direct?.totalMs, outcome.generation?.generationMs].filter(
    (value): value is number => value !== undefined,
  );
  return times.length === 0 ? null : times.reduce((sum, value) => sum + value, 0);
}

function timeDetail(outcome: CaseOutcome | undefined): string | undefined {
  if (!outcome) return undefined;
  const parts: string[] = [];
  if (outcome.direct) parts.push(`direct ${formatSeconds(outcome.direct.totalMs)}`);
  if (outcome.generation) parts.push(`json ${formatSeconds(outcome.generation.generationMs)}`);
  return parts.length === 0 ? undefined : parts.join(" · ");
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
  const showRatio = includesChoices(readout) && includesJson(readout);
  const byId = new Map(outcomes.map((outcome) => [outcome.id, outcome]));
  const totalMs = outcomes.reduce((sum, outcome) => sum + (caseMs(outcome) ?? 0), 0);

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
              <TableHead>time</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {cases.map((entry) => {
              const outcome = byId.get(entry.id);
              const running = entry.id === runningId;
              const ms = caseMs(outcome);
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
                        scores={directScores(outcome)}
                        tone="direct"
                        fallback={<Muted>{running ? "running…" : "—"}</Muted>}
                      />
                    </TableCell>
                  ) : null}

                  {showJson ? (
                    <TableCell
                      className="text-left align-top"
                      data-testid={`case-json-${entry.id}`}
                    >
                      <Distribution
                        scores={jsonScores(entry, outcome)}
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
                      ) ?? "—"}
                    </TableCell>
                  ) : null}

                  <TableCell
                    className="metric-value align-top font-mono text-xs"
                    title={timeDetail(outcome)}
                    data-testid={`case-time-${entry.id}`}
                  >
                    {ms === null ? "—" : formatSeconds(ms)}
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
                {outcomes.length === 0 ? "—" : formatSeconds(totalMs)}
              </TableCell>
            </TableRow>
          </tfoot>
        </Table>
      </CardContent>
    </Card>
  );
});
