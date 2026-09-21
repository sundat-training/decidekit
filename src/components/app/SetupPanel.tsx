import {
  Check,
  CircleAlert,
  CircleCheck,
  Download,
  Info,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";

import { ModelQualityTable } from "@/components/app/ModelQualityTable";
import { PhaseMetrics } from "@/components/app/PhaseMetrics";
import { SectionHeading } from "@/components/app/SectionHeading";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DownloadSnapshot } from "@/lib/download";
import { MODELS, MODEL_IDS, type ModelId, type NoticeTone } from "@/lib/models";

export interface SetupPanelProps {
  selected: ModelId;
  onSelect: (id: ModelId) => void;
  onLoad: () => void;
  /** `1` when this section doubles as the page title. */
  headingLevel?: 1 | 2;
  webgpuOk: boolean;
  canLoad: boolean;
  loading: boolean;
  modelReady: boolean;
  selectDisabled: boolean;
  download: DownloadSnapshot;
  loadMs: number | null;
  warmupMs: number | null;
  support: { text: string; tone: "info" | "ok" | "error" };
}

const NOTICE_TONE: Record<NoticeTone, "info" | "warning" | "destructive"> = {
  info: "info",
  caution: "warning",
  warning: "destructive",
};

const SUPPORT_TONE = {
  info: "info",
  ok: "success",
  error: "destructive",
} as const;

const SUPPORT_ICON = {
  info: Info,
  ok: CircleCheck,
  error: CircleAlert,
} as const;

export function SetupPanel({
  selected,
  onSelect,
  onLoad,
  headingLevel,
  webgpuOk,
  canLoad,
  loading,
  modelReady,
  selectDisabled,
  download,
  loadMs,
  warmupMs,
  support,
}: SetupPanelProps) {
  const model = MODELS[selected];
  const SupportIcon = SUPPORT_ICON[support.tone];
  const failed = webgpuOk && !modelReady && !loading && support.tone === "error";

  const loadLabel = modelReady
    ? "model ready"
    : loading
      ? "loading…"
      : failed
        ? `retry ${model.name} load`
        : `load ${model.name}`;
  const LoadIcon = modelReady ? Check : loading ? LoaderCircle : failed ? RotateCcw : Download;

  return (
    <Card className="gap-0 py-6">
      <SectionHeading
        className="px-6"
        index="01"
        label="setup"
        id="setup-title"
        level={headingLevel}
        title="Load the model once"
        description="Both readout paths share one quantized model. Weights come from Hugging Face and stay in the browser cache."
        actions={
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="model-select">Model</Label>
              <Select
                value={selected}
                onValueChange={(value) => onSelect(value as ModelId)}
                disabled={selectDisabled}
              >
                <SelectTrigger id="model-select" className="w-full sm:w-80" aria-label="Model">
                  <SelectValue className="truncate" />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_IDS.map((id) => (
                    <SelectItem key={id} value={id}>
                      {MODELS[id].name} · {MODELS[id].selectLabel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={onLoad} disabled={!canLoad} className="h-9" data-testid="load">
              <LoadIcon className={loading ? "animate-spin" : undefined} aria-hidden="true" />
              {loadLabel}
            </Button>
          </>
        }
      />

      <CardContent className="flex flex-col gap-4 pt-5">
        <Alert tone={NOTICE_TONE[model.noticeTone]}>
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <AlertDescription>{model.notice}</AlertDescription>
        </Alert>

        <ModelQualityTable selected={selected} />

        <Alert tone={SUPPORT_TONE[support.tone]} data-testid="support">
          <SupportIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <AlertDescription data-testid="support-text">{support.text}</AlertDescription>
        </Alert>

        <PhaseMetrics download={download} loadMs={loadMs} warmupMs={warmupMs} />

        <p className="text-xs leading-relaxed text-muted-foreground">
          {model.size} on first load for the selected tier. Inputs never leave this page. The first
          load can take several minutes depending on the model, network and GPU.
        </p>
      </CardContent>
    </Card>
  );
}
