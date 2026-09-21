/**
 * The inference worker: it owns wllama, the loaded model and the two readout
 * paths. The page never touches WebGPU directly, so switching models or
 * reloading the page cannot leak a half-initialized engine into the UI.
 */

import { MIN_OPTIONS, MAX_OPTIONS } from "@/lib/labels";
import { getModel, isModelId, type ModelId } from "@/lib/models";
import {
  runDirectReadout,
  runGeneration,
  isAsyncIterable,
  type CompletionClient,
} from "@/lib/inference/engine";
import type { CompareInput, WorkerEvent, WorkerRequest } from "@/lib/inference/protocol";

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

async function load(requestedModelId: string, useLocal: boolean): Promise<void> {
  if (engine) return;
  if (!isModelId(requestedModelId)) throw new Error("Choose one of the listed models.");
  const model = getModel(requestedModelId)!;
  modelId = model.id;

  const modelUrl = useLocal
    ? new URL(`./assets/${model.localFile}`, self.location.href).href
    : model.download;

  const wllama = await importWllama();
  engine = createWllama(wllama, { logger: wllama.LoggerWithoutDebug });

  send({ type: "loading", message: "Fetching the model or reading it from your browser cache…" });
  const loadStart = performance.now();
  await engine.loadModelFromUrl(modelUrl, {
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
  const warmup = await engine.createChatCompletion({
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
}

async function compare(data: CompareInput): Promise<void> {
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
  const direct = await runDirectReadout(client, data, model);
  send({ type: "direct", ...direct });

  send({ type: "generation-start" });
  const generation = await runGeneration(client, data, (update) =>
    send({ type: "generation-update", ...update }),
  );
  send({ type: "complete", ...generation, directMs: direct.totalMs });
}

async function handleRequest(request: WorkerRequest): Promise<void> {
  try {
    if (request.type === "load") await load(request.modelId, request.useLocal);
    if (request.type === "compare") await compare(request.data);
  } catch (error) {
    if (request.type === "load" && engine) {
      // Best-effort cleanup after a failed load so a retry starts clean.
      try {
        await engine.exit();
      } catch {
        /* the engine may already be torn down */
      }
      engine = undefined;
      modelId = undefined;
    }
    console.error(error);
    send({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }
}

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  void handleRequest(event.data);
});

export { WLLAMA_WASM_URL };
