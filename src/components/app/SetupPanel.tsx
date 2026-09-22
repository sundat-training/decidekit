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
import { Segmented } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DownloadSnapshot } from "@/lib/download";
import { MODELS, MODEL_IDS, type ModelId } from "@/lib/models";
import { READOUT_HINT, READOUT_LABEL, READOUT_MODES, type ReadoutMode } from "@/lib/readout";
import type { SupportTone } from "@/lib/runState";
import {
  NOTICE_ALERT_TONE,
  setupView,
  SUPPORT_ALERT_TONE,
  type LoadAction,
  type ModelStatus,
} from "@/lib/setupPanel";
import { cn } from "@/lib/utils";

const READOUT_OPTIONS = READOUT_MODES.map((value) => ({
  value,
  label: READOUT_LABEL[value],
}));

/** The one-line model status: its dot colour and how the state reads. */
const STATUS: Record<ModelStatus, { label: string; dot: string }> = {
  loading: { label: "loading…", dot: "bg-direct animate-pulse motion-reduce:animate-none" },
  ready: { label: "loaded locally", dot: "bg-success" },
  failed: { label: "load failed", dot: "bg-destructive" },
  idle: { label: "not loaded", dot: "bg-muted-foreground/50" },
};

/** The button's icon and wording for what it would do. */
const ACTION_ICON: Record<LoadAction, typeof Download> = {
  ready: Check,
  loading: LoaderCircle,
  retry: RotateCcw,
  switch: Download,
  load: Download,
};

/** The icon for the support line's tone. */
const SUPPORT_ICON: Record<SupportTone, typeof Info> = {
  info: Info,
  ok: CircleCheck,
  error: CircleAlert,
};

function loadLabel(action: LoadAction, modelName: string): string {
  switch (action) {
    case "ready":
      return "model ready";
    case "loading":
      return "loading…";
    case "retry":
      return `retry ${modelName} load`;
    case "switch":
      return `switch to ${modelName}`;
    default:
      return `load ${modelName}`;
  }
}

export interface SetupPanelProps {
  selected: ModelId;
  onSelect: (id: ModelId) => void;
  onLoad: () => void;
  /** Which readouts the next run computes. */
  readout: ReadoutMode;
  onReadoutChange: (mode: ReadoutMode) => void;
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
  /** Locks the panel controls while a load or a run is in flight. */
  busy: boolean;
  download: DownloadSnapshot;
  loadMs: number | null;
  warmupMs: number | null;
  support: { text: string; tone: SupportTone };
}

/**
 * The one-line readout that survives collapsing the panel: which tier is in
 * play, how large it is, and whether it is loaded. It stays in the section
 * heading so hiding the details never hides the selected model.
 */
function ModelStatusLine({
  modelName,
  modelSize,
  status,
}: {
  modelName: string;
  modelSize: string;
  status: ModelStatus;
}) {
  const state = STATUS[status];

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
  readout,
  onReadoutChange,
  headingLevel,
  open,
  onToggleOpen,
  webgpuOk,
  canLoad,
  loading,
  modelReady,
  loadedModelId,
  cachedTiers,
  busy,
  download,
  loadMs,
  warmupMs,
  support,
}: SetupPanelProps) {
  const model = MODELS[selected];
  const view = setupView({
    selected,
    loadedModelId,
    modelReady,
    loading,
    webgpuOk,
    supportTone: support.tone,
  });
  // The status line reports what is resident, not what the select points at.
  const shown = MODELS[view.shownModelId];
  const LoadIcon = ACTION_ICON[view.action];
  const SupportIcon = SUPPORT_ICON[support.tone];

  const supportAlert = (
    <Alert tone={SUPPORT_ALERT_TONE[support.tone]} data-testid="support">
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
            <ModelStatusLine modelName={shown.name} modelSize={shown.size} status={view.status} />
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
                disabled={busy}
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
              disabled={!canLoad || view.resident}
              className="h-9"
              data-testid="load"
            >
              <LoadIcon
                className={view.action === "loading" ? "animate-spin" : undefined}
                aria-hidden="true"
              />
              {loadLabel(view.action, model.name)}
            </Button>
          </div>

          <Alert tone={NOTICE_ALERT_TONE[model.noticeTone]}>
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

          <div className="mt-1 flex flex-col gap-4 border-t border-border pt-6">
            <SectionHeading
              index="02"
              label="readouts"
              id="readout-title"
              title="What should run"
              description="Both paths answer the same prompt. Selecting one skips the work of the other; the model, the question and the options stay identical."
            />

            <Segmented
              name="readout"
              legend="Results to compute and display"
              value={readout}
              options={READOUT_OPTIONS}
              onChange={onReadoutChange}
              disabled={busy}
            />

            <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">
              {READOUT_HINT[readout]}
            </p>
          </div>
        </CardContent>
      ) : support.tone === "error" ? (
        // A failure stays readable while the rest of the setup is hidden.
        <CardContent className="pt-4">{supportAlert}</CardContent>
      ) : null}
    </Card>
  );
}
