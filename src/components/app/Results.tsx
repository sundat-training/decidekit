import { CircleAlert, CircleCheck } from "lucide-react";
import type * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatSeconds, pluralize } from "@/lib/format";
import type {
  DirectOptionScore,
  DirectResult,
  GenerationResult,
  GenerationUpdate,
} from "@/lib/inference/protocol";
import { cn } from "@/lib/utils";

function Placeholder({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "active" }) {
  return (
    <div
      className={cn(
        "flex min-h-32 flex-1 items-center justify-center rounded-lg border border-dashed p-6 text-center font-mono text-xs",
        tone === "muted" ? "border-border text-muted-foreground" : "border-direct/40 text-direct",
      )}
    >
      {children}
    </div>
  );
}

function Metric({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 px-3 pt-3">
      <dt className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
        {term}
      </dt>
      <dd className="metric-value font-mono text-sm font-medium">{value}</dd>
    </div>
  );
}

function OptionBar({ option }: { option: DirectOptionScore }) {
  const percent = Math.max(1, option.probability * 100);
  return (
    <div className="grid grid-cols-[1.25rem_1fr_3.25rem] items-center gap-3">
      <span className="font-mono text-xs text-muted-foreground">{option.label}</span>
      <span className="flex min-w-0 flex-col gap-1.5">
        <span className="truncate text-xs text-muted-foreground" title={option.description}>
          {option.description}
        </span>
        <span className="h-1.5 overflow-hidden rounded-full bg-muted">
          <span
            className="block h-full rounded-full bg-direct transition-[width] duration-300 ease-out"
            style={{ width: `${percent}%` }}
            data-testid={`bar-${option.label}`}
          />
        </span>
      </span>
      <span className="metric-value text-right font-mono text-xs">
        {option.probability.toFixed(3)}
      </span>
    </div>
  );
}

export interface DirectLaneProps {
  direct: DirectResult | null;
  running: boolean;
}

export function DirectLane({ direct, running }: DirectLaneProps) {
  return (
    <Card className="gap-0 overflow-hidden border-t-2 border-t-direct py-6">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
            02A / direct readout
          </p>
          <CardTitle>Choice probabilities</CardTitle>
        </div>
        <Badge variant="direct">no decoding</Badge>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Read the model's choice logits and normalize only across the options you supplied.
        </p>
        {direct ? (
          <div className="flex flex-1 flex-col gap-3" data-testid="direct-output">
            {direct.options.map((option) => (
              <OptionBar key={option.label} option={option} />
            ))}
          </div>
        ) : (
          <Placeholder tone={running ? "active" : "muted"}>
            {running ? "running one forward pass…" : "waiting for a run"}
          </Placeholder>
        )}
        <dl className="grid grid-cols-3 divide-x divide-border border-t border-border">
          <Metric term="total" value={direct ? formatSeconds(direct.totalMs) : "—"} />
          <Metric term="input" value={direct ? `${direct.inputTokens} tok` : "—"} />
          <Metric
            term="output"
            value={direct ? pluralize(direct.readouts, "readout") : "—"}
          />
        </dl>
      </CardContent>
    </Card>
  );
}

export interface GenerationLaneProps {
  stream: GenerationUpdate | null;
  result: GenerationResult | null;
  running: boolean;
}

function validationLine(result: GenerationResult) {
  if (result.valid) {
    return {
      tone: "ok" as const,
      text: `valid JSON · top choice ${result.choice}`,
    };
  }
  return { tone: "error" as const, text: `unusable output · ${result.validationError}` };
}

export function GenerationLane({ stream, result, running }: GenerationLaneProps) {
  const text = stream?.text ?? "";
  const verdict = result ? validationLine(result) : null;
  const VerdictIcon = verdict?.tone === "ok" ? CircleCheck : CircleAlert;

  return (
    <Card className="gap-0 overflow-hidden border-t-2 border-t-generation py-6">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
            02B / generation
          </p>
          <CardTitle>JSON probabilities</CardTitle>
        </div>
        <Badge variant="generation">token by token</Badge>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Ask the model to estimate the same displayed-option distribution and write it as JSON.
        </p>

        {text ? (
          <pre
            className="flex-1 overflow-x-auto rounded-lg bg-muted/50 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap"
            data-testid="generation-output"
          >
            {text}
            {running ? <span className="streaming-caret text-generation">▍</span> : null}
          </pre>
        ) : (
          <Placeholder tone={running ? "active" : "muted"}>
            {running ? "waiting for the first token…" : "waiting for a run"}
          </Placeholder>
        )}

        {verdict ? (
          <p
            data-testid="generation-verdict"
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 font-mono text-[11px]",
              verdict.tone === "ok"
                ? "bg-success/8 text-success"
                : "bg-destructive/8 text-destructive",
            )}
          >
            <VerdictIcon className="size-3.5 shrink-0" aria-hidden="true" />
            {verdict.text}
          </p>
        ) : null}

        <dl className="grid grid-cols-2 divide-x divide-border border-t border-border sm:grid-cols-4">
          <Metric
            term="first token"
            value={result ? (result.ttftMs === null ? "no token" : formatSeconds(result.ttftMs)) : "—"}
          />
          <Metric term="total" value={result ? formatSeconds(result.generationMs) : "—"} />
          <Metric term="input" value={result ? `${result.inputTokens} tok` : "—"} />
          <Metric
            term="output"
            value={
              result
                ? `${result.generatedTokens} tok`
                : stream
                  ? `${stream.tokens} tok`
                  : "—"
            }
          />
        </dl>
      </CardContent>
    </Card>
  );
}

export interface ResultsSectionProps extends DirectLaneProps, Omit<GenerationLaneProps, "running"> {
  running: boolean;
}

export function ResultsSection({ direct, stream, result, running }: ResultsSectionProps) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <DirectLane direct={direct} running={running} />
      <GenerationLane stream={stream} result={result} running={running} />
    </div>
  );
}
