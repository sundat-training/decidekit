import { describe, expect, it } from "vitest";

import {
  DEFAULT_MODEL_ID,
  getModel,
  isModelId,
  MODELS,
  MODEL_IDS,
  PUBLISHED_BASELINE,
} from "@/lib/models";

const PINNED_REVISIONS = {
  "qwen3-0.6b": "23749fefcc72300e3a2ad315e1317431b06b590a",
  "minicpm5-2b": "2079a22f3beaa4e306449978533478fe0522f4b3",
  "qwen3.5-4b": "4168f45a16a1290d65a4ec0fa312ae917a4c15d6",
} as const;

describe("model tiers", () => {
  it("keeps the exact pinned revisions", () => {
    for (const [id, revision] of Object.entries(PINNED_REVISIONS)) {
      expect(MODELS[id as keyof typeof MODELS].revision).toBe(revision);
    }
  });

  it("pins every download URL to its revision", () => {
    for (const id of MODEL_IDS) {
      const model = MODELS[id];
      expect(model.download).toContain(`/resolve/${model.revision}/`);
      expect(model.revision).toMatch(/^[0-9a-f]{40}$/);
      expect(model.download.endsWith(".gguf")).toBe(true);
    }
  });

  it("keeps the label bases the direct readout depends on", () => {
    expect(MODELS["qwen3-0.6b"].labelBase).toBe(32);
    expect(MODELS["minicpm5-2b"].labelBase).toBe(54);
    expect(MODELS["qwen3.5-4b"].labelBase).toBe(32);
  });

  it("defaults to the desktop tier and lists every tier", () => {
    expect(DEFAULT_MODEL_ID).toBe("minicpm5-2b");
    expect(MODEL_IDS).toEqual(["qwen3-0.6b", "minicpm5-2b", "qwen3.5-4b"]);
    expect(MODEL_IDS.map((id) => MODELS[id].size)).toEqual(["639 MB", "1.56 GB", "3.01 GB"]);
  });

  it("carries the reference scores next to the published baseline", () => {
    expect(MODELS["qwen3-0.6b"].quality).toEqual({
      authored: "44.0%",
      perturbed: "52.8%",
      typeSafe: "40.7%",
    });
    expect(MODELS["minicpm5-2b"].quality).toEqual({
      authored: "68.6%",
      perturbed: "69.3%",
      typeSafe: "63.7%",
    });
    expect(MODELS["qwen3.5-4b"].quality).toEqual({
      authored: "81.3%",
      perturbed: "76.6%",
      typeSafe: "84.5%",
    });
    expect(PUBLISHED_BASELINE.typeSafe).toBe("88.3%");
  });

  it("warns about the trade-offs of each tier", () => {
    expect(MODELS["qwen3-0.6b"].notice).toContain("Accuracy may be worse");
    expect(MODELS["qwen3-0.6b"].noticeTone).toBe("caution");
    expect(MODELS["minicpm5-2b"].notice).toContain("may not fit on some low-end devices");
    expect(MODELS["qwen3.5-4b"].notice).toContain("High-memory desktop model");
    expect(MODELS["qwen3.5-4b"].noticeTone).toBe("warning");
  });

  it("narrows unknown ids instead of guessing", () => {
    expect(isModelId("minicpm5-2b")).toBe(true);
    expect(isModelId("gpt-9")).toBe(false);
    expect(getModel("gpt-9")).toBeUndefined();
    expect(getModel("qwen3.5-4b")?.name).toBe("Qwen3.5 4B");
  });
});
