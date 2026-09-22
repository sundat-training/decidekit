import { describe, expect, it } from "vitest";

import {
  NOTICE_ALERT_TONE,
  setupView,
  SUPPORT_ALERT_TONE,
  type SetupInput,
} from "@/lib/setupPanel";

function input(overrides: Partial<SetupInput> = {}): SetupInput {
  return {
    selected: "minicpm5-2b",
    loadedModelId: null,
    failedModelId: null,
    modelReady: false,
    loading: false,
    ...overrides,
  };
}

describe("setup view", () => {
  it("offers a load while nothing is resident", () => {
    const view = setupView(input());

    expect(view.action).toBe("load");
    expect(view.status).toBe("idle");
    expect(view.resident).toBe(false);
    expect(view.shownModelId).toBe("minicpm5-2b");
  });

  it("reports the resident tier while the select points at another one", () => {
    const view = setupView(
      input({ selected: "qwen3-0.6b", loadedModelId: "minicpm5-2b", modelReady: true }),
    );

    // The status line follows the weights, the button offers the switch.
    expect(view.shownModelId).toBe("minicpm5-2b");
    expect(view.status).toBe("ready");
    expect(view.action).toBe("switch");
    expect(view.resident).toBe(false);
  });

  it("has nothing to do while the select points at the resident tier", () => {
    const view = setupView(input({ loadedModelId: "minicpm5-2b", modelReady: true }));

    expect(view.resident).toBe(true);
    expect(view.action).toBe("ready");
  });

  it("reports a load in flight", () => {
    const view = setupView(input({ loading: true }));

    expect(view.status).toBe("loading");
    expect(view.action).toBe("loading");
  });

  it("offers a retry to the tier whose own load failed", () => {
    const view = setupView(input({ failedModelId: "minicpm5-2b" }));

    expect(view.failed).toBe(true);
    expect(view.status).toBe("failed");
    expect(view.action).toBe("retry");
  });

  it("lets a tier the select moved to afterwards start clean", () => {
    // The failure belongs to the tier that was on trial, not to the select, so
    // the other tier offers a plain load instead of a retry it does not owe.
    const view = setupView(input({ selected: "minicpm5-2b", failedModelId: "qwen3.5-4b" }));

    expect(view.failed).toBe(false);
    expect(view.status).toBe("idle");
    expect(view.action).toBe("load");
  });

  it("maps every tone to the alert tones the primitive styles", () => {
    expect(Object.values(SUPPORT_ALERT_TONE)).toEqual(["info", "success", "destructive"]);
    expect(Object.values(NOTICE_ALERT_TONE)).toEqual(["info", "warning", "destructive"]);
  });
});
