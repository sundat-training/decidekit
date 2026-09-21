/**
 * Model tiers and their pinned Hugging Face revisions.
 *
 * Every download URL carries a fixed revision so a run is reproducible. The
 * `labelBase` is the vocabulary offset of the first option letter for that
 * model's tokenizer: the direct readout biases exactly those token ids.
 */

export type ModelId = "qwen3-0.6b" | "minicpm5-2b" | "qwen3.5-4b";

export type NoticeTone = "info" | "caution" | "warning";

export interface ModelQuality {
  authored: string;
  perturbed: string;
  typeSafe: string;
}

export interface ModelTier {
  id: ModelId;
  name: string;
  short: string;
  size: string;
  /** Repository page, linked from the footer. */
  repo: string;
  /** Pinned GGUF artifact the worker fetches. */
  download: string;
  revision: string;
  /** Filename expected under `public/assets/` when running with `?local`. */
  localFile: string;
  labelBase: number;
  notice: string;
  noticeTone: NoticeTone;
  quality: ModelQuality;
  selectLabel: string;
}

export const MODELS: Record<ModelId, ModelTier> = {
  "qwen3-0.6b": {
    id: "qwen3-0.6b",
    name: "Qwen3 0.6B",
    short: "Qwen3 · 0.6B",
    size: "639 MB",
    repo: "https://huggingface.co/Qwen/Qwen3-0.6B-GGUF",
    download:
      "https://huggingface.co/Qwen/Qwen3-0.6B-GGUF/resolve/23749fefcc72300e3a2ad315e1317431b06b590a/Qwen3-0.6B-Q8_0.gguf",
    revision: "23749fefcc72300e3a2ad315e1317431b06b590a",
    localFile: "qwen3-0.6b.gguf",
    labelBase: 32,
    notice: "Smaller model optimized for small devices. Accuracy may be worse.",
    noticeTone: "caution",
    quality: { authored: "44.0%", perturbed: "52.8%", typeSafe: "40.7%" },
    selectLabel: "639 MB · for phones",
  },
  "minicpm5-2b": {
    id: "minicpm5-2b",
    name: "MiniCPM5 2B",
    short: "MiniCPM5 · 2B",
    size: "1.56 GB",
    repo: "https://huggingface.co/openbmb/MiniCPM5-2B-GGUF",
    download:
      "https://huggingface.co/openbmb/MiniCPM5-2B-GGUF/resolve/2079a22f3beaa4e306449978533478fe0522f4b3/MiniCPM5-2B-Q4_K_M.gguf",
    revision: "2079a22f3beaa4e306449978533478fe0522f4b3",
    localFile: "minicpm5-2b.gguf",
    labelBase: 54,
    notice: "Larger model. Loading may be slower or may not fit on some low-end devices.",
    noticeTone: "info",
    quality: { authored: "68.6%", perturbed: "69.3%", typeSafe: "63.7%" },
    selectLabel: "1.56 GB · desktop default",
  },
  "qwen3.5-4b": {
    id: "qwen3.5-4b",
    name: "Qwen3.5 4B",
    short: "Qwen3.5 · 4B",
    size: "3.01 GB",
    repo: "https://huggingface.co/bartowski/Qwen_Qwen3.5-4B-GGUF",
    download:
      "https://huggingface.co/bartowski/Qwen_Qwen3.5-4B-GGUF/resolve/4168f45a16a1290d65a4ec0fa312ae917a4c15d6/Qwen_Qwen3.5-4B-Q4_K_M.gguf",
    revision: "4168f45a16a1290d65a4ec0fa312ae917a4c15d6",
    localFile: "qwen3.5-4b.gguf",
    labelBase: 32,
    notice:
      "High-memory desktop model. Allow several gigabytes of free GPU memory and browser storage.",
    noticeTone: "warning",
    quality: { authored: "81.3%", perturbed: "76.6%", typeSafe: "84.5%" },
    selectLabel: "3.01 GB · high memory",
  },
};

export const MODEL_IDS = Object.keys(MODELS) as ModelId[];

export const DEFAULT_MODEL_ID: ModelId = "minicpm5-2b";

export function getModel(id: string): ModelTier | undefined {
  return (MODELS as Record<string, ModelTier>)[id];
}

export function isModelId(id: string): id is ModelId {
  return Object.hasOwn(MODELS, id);
}

/**
 * The published hosted baseline shown next to the local tiers. It is a
 * reference number from the upstream evaluation, never a live measurement.
 */
export const PUBLISHED_BASELINE = {
  name: "Published Jev",
  download: "hosted",
  authored: "—",
  perturbed: "—",
  typeSafe: "88.3%",
} as const;

export const QUALITY_NOTE =
  "Owned columns are balanced accuracy. TypeSafe is equal-case agreement on the same 102-row public subset; Jev is the published value. Browser quantization may change model accuracy.";

/** Phone-class devices get a pointer toward the smallest tier. */
export function detectSmallDevice(): boolean {
  // Typed structurally so this module stays free of DOM-only lib types and can
  // also be type-checked inside the worker program.
  const scope = globalThis as {
    navigator?: { userAgent?: string; userAgentData?: { mobile?: boolean } };
    matchMedia?: (query: string) => { matches: boolean };
  };
  const userAgent = scope.navigator?.userAgent ?? "";
  return (
    scope.navigator?.userAgentData?.mobile === true ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) ||
    scope.matchMedia?.("(max-width: 600px)").matches === true
  );
}
