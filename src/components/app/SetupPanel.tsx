import {
  Check,
  CircleAlert,
  CircleCheck,
  Download,
  Info,
  LoaderCircle,
  PanelTopClose,
  PanelTopOpen,
  RotateCcw,
} from "lucide-react";

import { ModelQualityTable } from "@/components/app/ModelQualityTable";
import { PhaseMetrics } from "@/components/app/PhaseMetrics";
import { SectionHeading } from "@/components/app/SectionHeading";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";

export interface SetupPanelProps {
  selected: ModelId;
  onSelect: (id: ModelId) => void;
  onLoad: () => void;
  /** `1` when this section doubles as the page title. */
  headingLevel?: 1 | 2;
  /** Whether the setup details are expanded. The model line stays visible either way. */
  open: boolean;
  onToggleOpen: () => void;
  webgpuOk: boolean;
  canLoad: boolean;
  loading: boolean;
  modelReady: boolean;
  /** The tier whose weights are resident, so the button can offer a switch. */
  loadedModelId: ModelId | null;
  /** Tiers this browser has loaded before; marked as cached in the list. */
  cachedTiers: ModelId[];
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

/**
 * The one-line readout that survives collapsing the panel: which tier is in
 * play, how large it is, and whether it is loaded. It stays in the section
 * heading so hiding the details never hides the selected model.
 */
function ModelStatus({
  modelName,
  modelSize,
  ready,
  loading,
  failed,
}: {
  modelName: string;
  modelSize: string;
  ready: boolean;
  loading: boolean;
  failed: boolean;
}) {
  const state = loading
    ? { label: "loading…", dot: "bg-direct animate-pulse motion-reduce:animate-none" }
    : ready
      ? { label: "loaded locally", dot: "bg-success" }
      : failed
        ? { label: "load failed", dot: "bg-destructive" }
        : { label: "not loaded", dot: "bg-muted-foreground/50" };

  return (
    <p
      className="flex items-center gap-2 font-mono text-xs whitespace-nowrap"
      data-testid="current-model"
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", state.dot)} aria-hidden="true" />
      <span className="text-muted-foreground">
        <span className="font-medium text-foreground">{modelName}</span> · {modelSize} ·{" "}
        {state.label}
      </span>
    </p>
  );
}

export function SetupPanel({
  selected,
  onSelect,
  onLoad,
  headingLevel,
  open,
  onToggleOpen,
  webgpuOk,
  canLoad,
  loading,
  modelReady,
  loadedModelId,
  cachedTiers,
  selectDisabled,
  download,
  loadMs,
  warmupMs,
  support,
}: SetupPanelProps) {
  const model = MODELS[selected];
  const SupportIcon = SUPPORT_ICON[support.tone];
  const failed = webgpuOk && !modelReady && !loading && support.tone === "error";

  // The status line reports what is resident, not what the select points at, so
  // a pending switch stays visible next to a control that already moved on.
  const shown = modelReady && loadedModelId ? MODELS[loadedModelId] : model;
  const resident = modelReady && loadedModelId === selected;

  const loadLabel = resident
    ? "model ready"
    : loading
      ? "loading…"
      : failed
        ? `retry ${model.name} load`
        : modelReady
          ? `switch to ${model.name}`
          : `load ${model.name}`;
  const LoadIcon = resident ? Check : loading ? LoaderCircle : failed ? RotateCcw : Download;

  const supportAlert = (
    <Alert tone={SUPPORT_TONE[support.tone]} data-testid="support">
      <SupportIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <AlertDescription data-testid="support-text">{support.text}</AlertDescription>
    </Alert>
  );

  return (
    <Card className="gap-0 py-6">
      <SectionHeading
        className="px-6"
        index="01"
        label="setup"
        id="setup-title"
        level={headingLevel}
        title="Load the model once"
        titleHidden={!open}
        description={
          open
            ? "Both readout paths share one quantized model. Weights come from Hugging Face and stay in the browser cache."
            : undefined
        }
        eyebrowAction={
          <>
            <ModelStatus
              modelName={shown.name}
              modelSize={shown.size}
              ready={modelReady}
              loading={loading}
              failed={failed}
            />
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={onToggleOpen}
              aria-expanded={open}
              aria-label={open ? "Hide setup" : "Show setup"}
              title={open ? "Hide setup" : "Show setup"}
              data-testid="setup-toggle"
            >
              {open ? (
                <PanelTopClose className="size-5 lucide-crisp" aria-hidden="true" />
              ) : (
                <PanelTopOpen className="size-5 lucide-crisp" aria-hidden="true" />
              )}
            </Button>
          </>
        }
      />

      {open ? (
        <CardContent className="flex flex-col gap-4 pt-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
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
                    <SelectItem
                      key={id}
                      value={id}
                      hint={
                        cachedTiers.includes(id) ? (
                          <Badge variant="outline" data-testid="cached-badge">
                            cached
                          </Badge>
                        ) : undefined
                      }
                    >
                      {MODELS[id].name} · {MODELS[id].selectLabel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={onLoad}
              disabled={!canLoad || resident}
              className="h-9"
              data-testid="load"
            >
              <LoadIcon className={loading ? "animate-spin" : undefined} aria-hidden="true" />
              {loadLabel}
            </Button>
          </div>

          <Alert tone={NOTICE_TONE[model.noticeTone]}>
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <AlertDescription>{model.notice}</AlertDescription>
          </Alert>

          <ModelQualityTable selected={selected} />

          {supportAlert}

          <PhaseMetrics download={download} loadMs={loadMs} warmupMs={warmupMs} />

          <p className="text-xs leading-relaxed text-muted-foreground">
            {model.size} on first load for the selected tier. A tier marked cached was loaded in
            this browser before, so switching to it should not download again. Inputs never leave
            this page.
          </p>
        </CardContent>
      ) : support.tone === "error" ? (
        // A failure stays readable while the rest of the setup is hidden.
        <CardContent className="pt-4">{supportAlert}</CardContent>
      ) : null}
    </Card>
  );
}
