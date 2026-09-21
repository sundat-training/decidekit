import { describe, expect, it } from "vitest";

/**
 * Source-level contract, in the spirit of the static checks the original
 * browser lab shipped with: the page stays browser-only, the runtime stays
 * pinned, and the documented limitations stay visible.
 */
const modules = import.meta.glob("./**/*.{ts,tsx,css}", {
  query: "?raw",
  import: "default",
  eager: true,
});

const productionSources = Object.entries(modules)
  .filter(([path]) => !path.includes(".test."))
  .map(([, source]) => source);

const combined = productionSources.join("\n");

const PINNED_REVISIONS = [
  "23749fefcc72300e3a2ad315e1317431b06b590a",
  "2079a22f3beaa4e306449978533478fe0522f4b3",
  "4168f45a16a1290d65a4ec0fa312ae917a4c15d6",
];

describe("browser-only contract", () => {
  it("has no backend surface", () => {
    // Usage, not prose: the About page may state that none of this exists.
    const backendUsage = [
      /new\s+WebSocket\b/,
      /\bWebSocket\s*\(/,
      /new\s+XMLHttpRequest\b/,
      /new\s+EventSource\b/,
      /\bsendBeacon\s*\(/,
      /\/api\/(?:generate|score)/,
    ];
    for (const pattern of backendUsage) {
      expect(combined, `source must not use ${String(pattern)}`).not.toMatch(pattern);
    }
  });

  it("times real work instead of shipping canned numbers", () => {
    expect(combined).toContain("performance.now()");
  });

  it("keeps both readout paths in the engine", () => {
    expect(combined).toContain("logprobs: true");
    expect(combined).toContain("top_logprobs: 20");
    expect(combined).toContain("stream: true");
    expect(combined).toContain("grammar");
    expect(combined).toContain("probabilities must sum to 1");
    expect(combined).toContain("Route north");
  });

  it("keeps every pinned model revision in the source", () => {
    for (const revision of PINNED_REVISIONS) expect(combined).toContain(revision);
  });

  it("keeps the probability and timing caveats visible", () => {
    expect(combined).toContain("not calibrated confidence");
    expect(combined).toContain("no backend");
    expect(combined).toContain("run sequentially");
    expect(combined).toContain("Quantization can change both quality and speed");
    expect(combined).toContain("prefers-reduced-motion");
  });

  it("never sends the hosting URL as a referrer", () => {
    expect(combined).toContain('referrerPolicy: "no-referrer"');
  });
});

describe("static hosting contract", () => {
  it("ships cross-origin isolation headers", async () => {
    const response = await fetch("/_headers");
    expect(response.ok).toBe(true);
    const text = await response.text();
    expect(text).toContain("Referrer-Policy: no-referrer");
    expect(text).toContain("Cross-Origin-Opener-Policy: same-origin");
    expect(text).toContain("Cross-Origin-Embedder-Policy: require-corp");
  });

  it("serves the vendored inference engine and its wasm", async () => {
    const module = await fetch("/vendor/wllama/index.js");
    expect(module.ok).toBe(true);
    expect(await module.text()).toContain("Wllama");

    const wasm = await fetch("/vendor/wllama/wasm/wllama.wasm");
    expect(wasm.ok).toBe(true);
    const bytes = await wasm.arrayBuffer();
    expect(bytes.byteLength).toBeGreaterThan(1_000_000);
  });
});
