import { Progress } from "@/components/ui/progress";
import { formatSecondsOrDash } from "@/lib/format";
import type { DownloadSnapshot } from "@/lib/download";

export interface PhaseMetricsProps {
  download: DownloadSnapshot;
  loadMs: number | null;
  warmupMs: number | null;
}

function Value({ value, testId }: { value: string; testId: string }) {
  return (
    <span className="metric-value font-mono text-xl font-medium" data-testid={testId}>
      {value}
    </span>
  );
}

/**
 * The three setup phases are reported separately so download time, model load
 * and shader warmup never hide inside one number.
 */
export function PhaseMetrics({ download, loadMs, warmupMs }: PhaseMetricsProps) {
  return (
    <dl className="grid divide-y divide-border overflow-hidden rounded-lg border border-border sm:grid-cols-[1.4fr_1fr_1fr] sm:divide-x sm:divide-y-0">
      <div className="flex flex-col gap-2 p-4">
        <dt className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
          download / cache
        </dt>
        <dd className="flex flex-col gap-2">
          <Value value={download.value} testId="download-value" />
          <Progress value={download.percent ?? 0} indicatorClassName="bg-direct" />
          <span className="text-xs leading-relaxed text-muted-foreground">{download.detail}</span>
        </dd>
      </div>
      <div className="flex flex-col gap-2 p-4">
        <dt className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
          model load
        </dt>
        <dd className="flex flex-col gap-1.5">
          <Value value={formatSecondsOrDash(loadMs)} testId="load-value" />
          <span className="text-xs leading-relaxed text-muted-foreground">
            download and prepare
          </span>
        </dd>
      </div>
      <div className="flex flex-col gap-2 p-4">
        <dt className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
          warmup
        </dt>
        <dd className="flex flex-col gap-1.5">
          <Value value={formatSecondsOrDash(warmupMs)} testId="warmup-value" />
          <span className="text-xs leading-relaxed text-muted-foreground">
            compile passes for both paths
          </span>
        </dd>
      </div>
    </dl>
  );
}
