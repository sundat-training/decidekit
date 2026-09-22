/**
 * What the setup panel decides before it renders anything.
 *
 * The panel is a data surface: which tier the status line reports, whether the
 * select already points at it, what the load button offers and how a finished
 * attempt is toned. None of that needs React, so it is decided here and the
 * component only maps the result to icons, classes and wording.
 */

import type { ModelId, NoticeTone } from "@/lib/models";
import type { SupportTone } from "@/lib/support";

/** The tones the `Alert` primitive styles. */
export type AlertTone = "info" | "success" | "warning" | "destructive";

/** How a model's own notice is toned when the panel shows it. */
export const NOTICE_ALERT_TONE: Record<NoticeTone, AlertTone> = {
  info: "info",
  caution: "warning",
  warning: "destructive",
};

/** How the support line under the metrics is toned. */
export const SUPPORT_ALERT_TONE: Record<SupportTone, AlertTone> = {
  info: "info",
  ok: "success",
  error: "destructive",
};

/** What the one-line model status currently says. */
export type ModelStatus = "idle" | "loading" | "ready" | "failed";

/** What the load button currently offers. */
export type LoadAction = "load" | "switch" | "retry" | "loading" | "ready";

export interface SetupInput {
  /** The tier the select points at. */
  selected: ModelId;
  /** The tier whose weights are resident, or null while nothing is loaded. */
  loadedModelId: ModelId | null;
  /** The tier whose last load attempt failed, or null while none did. */
  failedModelId: ModelId | null;
  modelReady: boolean;
  loading: boolean;
}

export interface SetupView {
  status: ModelStatus;
  action: LoadAction;
  /**
   * The tier the status line reports. It is what is resident rather than what
   * the select points at, so a pending switch stays visible next to a control
   * that has already moved on.
   */
  shownModelId: ModelId;
  /** True when the select already points at the tier whose weights are resident. */
  resident: boolean;
  /** True when the selected tier's own load attempt failed. */
  failed: boolean;
}

export function setupView(input: SetupInput): SetupView {
  // Only the tier that failed is a failure. A tier the select moves to
  // afterwards has simply not been loaded yet, so it offers a plain load rather
  // than a retry it does not owe.
  const failed = input.failedModelId === input.selected;
  const resident = input.modelReady && input.loadedModelId === input.selected;

  const status: ModelStatus = input.loading
    ? "loading"
    : input.modelReady
      ? "ready"
      : failed
        ? "failed"
        : "idle";

  const action: LoadAction = resident
    ? "ready"
    : input.loading
      ? "loading"
      : failed
        ? "retry"
        : input.modelReady
          ? "switch"
          : "load";

  return {
    status,
    action,
    shownModelId: input.modelReady && input.loadedModelId ? input.loadedModelId : input.selected,
    resident,
    failed,
  };
}
