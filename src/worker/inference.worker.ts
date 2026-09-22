/**
 * The inference worker: it owns wllama, the loaded model and the two readout
 * paths. The page never touches WebGPU directly, so switching models or
 * reloading the page cannot leak a half-initialized engine into the UI.
 */

import { MIN_OPTIONS, MAX_OPTIONS } from "@/lib/labels";
import { getModel, isModelId, type ModelId } from "@/lib/models";
import { includesChoices, includesJson, type ReadoutMode } from "@/lib/readout";
import {
  runDirectReadout,
  runGeneration,
  isAsyncIterable,
  type CompletionClient,
} from "@/lib/inference/engine";
import type { DecisionInput } from "@/lib/decision";
import type { GenerationResult, WorkerEvent, WorkerRequest } from "@/lib/inference/protocol";

import { createWllama, importWllama, WLLAMA_WASM_URL, type WllamaInstance } from "./wllama";

// Same policy as the document: never send the hosting URL to Hugging Face.
const browserFetch = self.fetch.bind(self);
self.fetch = (input: RequestInfo | URL, init?: RequestInit) =>
  browserFetch(input, { ...init, referrerPolicy: "no-referrer" });

function send(event: WorkerEvent): void {
  self.postMessage(event);
}

let engine: WllamaInstance | undefined;
let modelId: ModelId | undefined;
let loadInFlight = false;

/**
 * Frees the resident weights. Switching tiers releases first, so two quantized
 * models never sit in GPU memory at the same time.
 */
async function releaseEngine(): Promise<void> {
  const resident = engine;
  engine = undefined;
  modelId = undefined;
  if (!resident) return;
  try {
    await resident.exit();
  } catch {
    /* the engine may already be torn down */
  }
}

async function load(requestedModelId: string, useLocal: boolean): Promise<void> {
  if (!isModelId(requestedModelId)) throw new Error("Choose one of the listed models.");
  if (loadInFlight) throw new Error("A model is already loading.");
  const model = getModel(requestedModelId)!;

  loadInFlight = true;
  try {
    await releaseEngine();

    const modelUrl = useLocal
      ? new URL(`./assets/${model.localFile}`, self.location.href).href
      : model.download;

    const wllama = await importWllama();
    const created = createWllama(wllama, { logger: wllama.LoggerWithoutDebug });
    engine = created;
    modelId = model.id;

    send({ type: "loading", message: "Fetching the model or reading it from your browser cache…" });
    const loadStart = performance.now();
    await created.loadModelFromUrl(modelUrl, {
      n_ctx: 2048,
      n_batch: 512,
      n_gpu_layers: 999,
      cache_prompt: false,
      progressCallback: ({ loaded, total }) =>
        send({
          type: "progress",
          event: {
            status: "progress",
            file: modelUrl,
            loaded,
            total,
            text: total
              ? `${((loaded / total) * 100).toFixed(0)}% of model downloaded or read from cache`
              : "loading model",
          },
        }),
    });
    send({ type: "loaded", loadMs: performance.now() - loadStart });

    send({ type: "loading", message: "Model loaded. Compiling a real model pass…" });
    const warmupStart = performance.now();
    const warmup = await created.createChatCompletion({
      messages: [{ role: "user", content: "Reply with the single word ready." }],
      max_tokens: 1,
      temperature: 0,
      cache_prompt: false,
      chat_template_kwargs: { enable_thinking: false },
    });
    if (isAsyncIterable(warmup) || !warmup?.choices?.length) {
      throw new Error("Model warmup returned no completion.");
    }

    send({
      type: "ready",
      warmupMs: performance.now() - warmupStart,
      modelId: model.id,
      modelName: model.name,
    });
  } catch (error) {
    // Nothing usable is resident after a failure, so a retry starts clean.
    await releaseEngine();
    throw error;
  } finally {
    loadInFlight = false;
  }
}

async function compare(data: DecisionInput, readout: ReadoutMode): Promise<void> {
  if (!engine) throw new Error("Load the model before running a comparison.");
  const model = modelId ? getModel(modelId) : undefined;
  if (!model) throw new Error("Load the model before running a comparison.");
  if (
    !Array.isArray(data.options) ||
    data.options.length < MIN_OPTIONS ||
    data.options.length > MAX_OPTIONS
  ) {
    throw new Error(`This lab requires ${MIN_OPTIONS} to ${MAX_OPTIONS} options.`);
  }

  const client: CompletionClient = engine;
  let generation: GenerationResult | null = null;

  if (includesChoices(readout)) {
    const direct = await runDirectReadout(client, data, model);
    send({ type: "direct", ...direct });
  }

  if (includesJson(readout)) {
    send({ type: "generation-start" });
    generation = await runGeneration(client, data, (update) =>
      send({ type: "generation-update", ...update }),
    );
  }

  send({ type: "complete", generation });
}

async function handleRequest(request: WorkerRequest): Promise<void> {
  try {
    if (request.type === "load") await load(request.modelId, request.useLocal);
    if (request.type === "compare") await compare(request.data, request.readout);
  } catch (error) {
    console.error(error);
    send({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }
}

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  void handleRequest(event.data);
});

export { WLLAMA_WASM_URL };
