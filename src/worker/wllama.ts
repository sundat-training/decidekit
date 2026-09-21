/**
 * Loads the vendored wllama build from `public/vendor/wllama/`.
 *
 * The engine is deliberately not bundled: it is a prebuilt WASM runtime that
 * resolves its own assets relative to its script URL, so it is fetched at
 * runtime from the same origin and imported with `@vite-ignore`.
 */

import type { ChatCompletionResponse } from "@/lib/decision";
import type { ChatCompletionRequest, CompletionClient } from "@/lib/inference/engine";

export interface WllamaProgress {
  loaded: number;
  total: number;
}

export interface WllamaLoadOptions {
  n_ctx: number;
  n_batch: number;
  n_gpu_layers: number;
  cache_prompt: boolean;
  progressCallback: (progress: WllamaProgress) => void;
}

export interface WllamaInstance extends CompletionClient {
  loadModelFromUrl(url: string, options: WllamaLoadOptions): Promise<void>;
  exit(): Promise<void>;
}

interface WllamaModule {
  Wllama: new (
    paths: { default: string },
    config: { logger: unknown; suppressNativeLog: boolean; parallelDownloads: number },
  ) => WllamaInstance;
  LoggerWithoutDebug: unknown;
}

const base = import.meta.env.BASE_URL;

export const WLLAMA_INDEX_URL = new URL(`${base}vendor/wllama/index.js`, self.location.origin).href;
export const WLLAMA_WASM_URL = new URL(`${base}vendor/wllama/wasm/wllama.wasm`, self.location.origin)
  .href;

export async function importWllama(): Promise<WllamaModule> {
  return (await import(/* @vite-ignore */ WLLAMA_INDEX_URL)) as WllamaModule;
}

export interface CreateWllamaOptions {
  /** Logger implementation; the vendored default only surfaces warnings. */
  logger: unknown;
  parallelDownloads?: number;
}

export function createWllama(module: WllamaModule, options: CreateWllamaOptions): WllamaInstance {
  return new module.Wllama(
    { default: WLLAMA_WASM_URL },
    {
      logger: options.logger,
      suppressNativeLog: true,
      parallelDownloads: options.parallelDownloads ?? 4,
    },
  );
}

/** Narrowing helper for the non-streaming warmup call. */
export function readWarmupChoices(
  response: ChatCompletionResponse | AsyncIterable<ChatCompletionResponse>,
): ChatCompletionResponse["choices"] {
  if (Symbol.asyncIterator in Object(response ?? {})) return undefined;
  return (response as ChatCompletionResponse).choices;
}

export type { ChatCompletionRequest };
