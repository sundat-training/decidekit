import { page, type Locator } from "vitest/browser";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { App } from "@/App";
import type { WebGPUProbe, WorkerLike } from "@/hooks/useInference";
import type { WorkerEvent, WorkerRequest } from "@/lib/inference/protocol";
import { DEFAULT_DECISION } from "@/lib/presets";
import { createAppRouter } from "@/router";

/** Stands in for the inference worker so the lab runs without a GPU. */
class FakeWorker {
  readonly requests: WorkerRequest[] = [];
  private readonly messageListeners: Array<(event: MessageEvent<WorkerEvent>) => void> = [];
  private readonly errorListeners: Array<(event: ErrorEvent) => void> = [];

  postMessage(message: WorkerRequest): void {
    this.requests.push(message);
  }

  addEventListener(type: string, listener: unknown): void {
    if (type === "message") {
      this.messageListeners.push(listener as (event: MessageEvent<WorkerEvent>) => void);
    }
    if (type === "error") {
      this.errorListeners.push(listener as (event: ErrorEvent) => void);
    }
  }

  terminate(): void {
    // no resources to release
  }

  emit(event: WorkerEvent): void {
    for (const listener of this.messageListeners) {
      listener({ data: event } as MessageEvent<WorkerEvent>);
    }
  }

  emitWorkerError(message: string): void {
    for (const listener of this.errorListeners) {
      listener({ message } as unknown as ErrorEvent);
    }
  }

  asWorkerLike(): WorkerLike {
    return this;
  }
}

const READY_PROBE: WebGPUProbe = async () => ({
  ok: true,
  message: "WebGPU is ready. The model does not download until you load it.",
});

const UNSUPPORTED_PROBE: WebGPUProbe = async () => ({
  ok: false,
  message: "WebGPU is unavailable. Use a current WebGPU-capable browser over HTTPS or localhost.",
});

async function textOf(locator: Locator): Promise<string> {
  const element = await locator.findElement();
  return element.textContent ?? "";
}

/**
 * Reads and asserts in one retrying step: React renders in its own task, so an
 * immediate read would still see the previous text.
 */
async function waitForText(locator: Locator, expected: string): Promise<void> {
  await vi.waitFor(async () => {
    expect(await textOf(locator)).toBe(expected);
  });
}

async function waitForTextMatching(locator: Locator, pattern: RegExp): Promise<void> {
  await vi.waitFor(async () => {
    expect(await textOf(locator)).toMatch(pattern);
  });
}

async function waitForDisabled(locator: Locator, disabled: boolean): Promise<void> {
  await vi.waitFor(async () => {
    const element = (await locator.findElement()) as HTMLButtonElement;
    expect(element.disabled).toBe(disabled);
  });
}

async function waitForChecked(locator: Locator, checked: boolean): Promise<void> {
  await vi.waitFor(async () => {
    const element = (await locator.findElement()) as HTMLInputElement;
    expect(element.checked).toBe(checked);
  });
}

async function waitForCount(locator: Locator, count: number): Promise<void> {
  await vi.waitFor(() => {
    expect(locator.elements()).toHaveLength(count);
  });
}

async function waitForAttribute(locator: Locator, name: string, expected: string): Promise<void> {
  await vi.waitFor(async () => {
    const element = await locator.findElement();
    expect(element.getAttribute(name)).toBe(expected);
  });
}

/** `sr-only` keeps an element in the outline while taking it out of the layout. */
async function waitForSrOnly(locator: Locator, srOnly: boolean): Promise<void> {
  await vi.waitFor(async () => {
    const element = (await locator.findElement()) as HTMLElement;
    expect(element.classList.contains("sr-only")).toBe(srOnly);
  });
}

async function waitForFieldValue(locator: Locator, expected: string): Promise<void> {
  await vi.waitFor(async () => {
    const element = (await locator.findElement()) as HTMLInputElement | HTMLTextAreaElement;
    expect(element.value).toBe(expected);
  });
}

async function waitForFieldValueMatching(locator: Locator, pattern: RegExp): Promise<void> {
  await vi.waitFor(async () => {
    const element = (await locator.findElement()) as HTMLInputElement | HTMLTextAreaElement;
    expect(element.value).toMatch(pattern);
  });
}

/**
 * Worker events arrive outside React's event handlers. The state update they
 * trigger is picked up by the retrying assertions below, so no manual act()
 * wrapper is needed — vitest-browser-react manages React's act environment.
 */
async function emit(worker: FakeWorker, event: WorkerEvent): Promise<void> {
  worker.emit(event);
}

async function emitWorkerError(worker: FakeWorker, message: string): Promise<void> {
  worker.emitWorkerError(message);
}

/** Every test starts on the lab route with its own router history and no cache record. */
beforeEach(() => {
  window.history.replaceState(null, "", "/");
  window.localStorage.clear();
});

async function setup(probe: WebGPUProbe = READY_PROBE) {
  const worker = new FakeWorker();
  await render(
    <App createWorker={() => worker.asWorkerLike()} probe={probe} router={createAppRouter()} />,
  );
  return worker;
}

/** Renders the app straight at a path, without going through the lab first. */
async function setupAt(path: string, probe: WebGPUProbe = READY_PROBE) {
  window.history.replaceState(null, "", path);
  return setup(probe);
}

function mainNav(): Locator {
  return page.getByRole("navigation", { name: "Main" });
}

/** Picks one of the readout modes in the setup section. */
async function pickReadout(mode: "Choices only" | "JSON only" | "Both"): Promise<void> {
  await page.getByRole("radio", { name: mode }).click();
}

/** Loads the default tier and waits until both paths can run. */
async function loadDefaultModel(worker: FakeWorker): Promise<void> {
  await page.getByTestId("load").click();
  await emit(worker, {
    type: "ready",
    warmupMs: 88,
    modelId: "minicpm5-2b",
    modelName: "MiniCPM5 2B",
  });
  await waitForDisabled(page.getByTestId("run"), false);
}

describe("compatibility check", () => {
  it("reports a usable WebGPU before anything is downloaded", async () => {
    await setup();

    await waitForTextMatching(page.getByTestId("support-text"), /WebGPU is ready/);
    await waitForDisabled(page.getByTestId("load"), false);
  });

  it("blocks loading when WebGPU is missing", async () => {
    await setup(UNSUPPORTED_PROBE);

    await waitForTextMatching(page.getByTestId("support-text"), /WebGPU is unavailable/);
    await waitForDisabled(page.getByTestId("load"), true);
  });

  it("shows no results until a run happens", async () => {
    await setup();

    await waitForDisabled(page.getByTestId("run"), true);
    // Choices is the default, so only the direct lane is on screen.
    await waitForCount(page.getByText("waiting for a run"), 1);
    expect(page.getByTestId("generation-output").elements()).toHaveLength(0);
  });
});

describe("model setup", () => {
  it("loads the default tier and reports each setup phase", async () => {
    const worker = await setup();

    await page.getByTestId("load").click();
    expect(worker.requests).toEqual([{ type: "load", modelId: "minicpm5-2b", useLocal: false }]);

    await emit(worker, {
      type: "progress",
      event: {
        status: "progress",
        file: "MiniCPM5-2B-Q4_K_M.gguf",
        loaded: 50,
        total: 100,
        text: "50% of model downloaded or read from cache",
      },
    });
    await waitForText(page.getByTestId("download-value"), "50%");

    await emit(worker, { type: "loaded", loadMs: 1234 });
    await waitForText(page.getByTestId("load-value"), "1.234 s");

    await emit(worker, {
      type: "ready",
      warmupMs: 88,
      modelId: "minicpm5-2b",
      modelName: "MiniCPM5 2B",
    });
    await waitForText(page.getByTestId("warmup-value"), "0.088 s");
    await waitForTextMatching(page.getByTestId("support-text"), /MiniCPM5 2B is loaded locally/);
    await waitForDisabled(page.getByTestId("run"), false);
    await waitForDisabled(page.getByTestId("load"), true);
  });

  it("loads whichever tier the visitor selected", async () => {
    const worker = await setup();

    await page.getByRole("combobox", { name: "Model" }).click();
    await page.getByRole("option", { name: /Qwen3 0.6B/ }).click();
    await page.getByTestId("load").click();

    expect(worker.requests).toEqual([{ type: "load", modelId: "qwen3-0.6b", useLocal: false }]);
  });

  it("surfaces a worker failure and allows a retry", async () => {
    const worker = await setup();

    await page.getByTestId("load").click();
    await emit(worker, { type: "error", message: "No GPU adapter." });

    await waitForText(page.getByTestId("support-text"), "No GPU adapter.");
    await waitForDisabled(page.getByTestId("load"), false);

    await emitWorkerError(worker, "Worker crashed");
    await waitForTextMatching(page.getByTestId("support-text"), /Worker failed: Worker crashed/);
  });

  it("hides the setup details but keeps the current model visible", async () => {
    await setup();

    const title = page.getByRole("heading", { level: 1, name: "Load the model once" });

    await waitForTextMatching(
      page.getByTestId("current-model"),
      /MiniCPM5 2B · 1\.56 GB · not loaded/,
    );
    await waitForCount(page.getByTestId("load"), 1);
    await waitForAttribute(page.getByTestId("setup-toggle"), "aria-label", "Hide setup");
    await waitForSrOnly(title, false);

    await page.getByTestId("setup-toggle").click();

    await waitForCount(page.getByTestId("load"), 0);
    await waitForCount(page.getByRole("combobox", { name: "Model" }), 0);
    await waitForCount(page.getByText(/Both readout paths share one quantized model/), 0);
    await waitForAttribute(page.getByTestId("setup-toggle"), "aria-label", "Show setup");
    await waitForTextMatching(
      page.getByTestId("current-model"),
      /MiniCPM5 2B · 1\.56 GB · not loaded/,
    );
    // The title leaves the layout but stays in the document outline.
    await waitForSrOnly(title, true);

    await page.getByTestId("setup-toggle").click();
    await waitForCount(page.getByTestId("load"), 1);
    await waitForCount(page.getByText(/Both readout paths share one quantized model/), 1);
    await waitForSrOnly(title, false);
  });

  it("keeps the loaded model visible in the collapsed panel", async () => {
    const worker = await setup();
    await loadDefaultModel(worker);

    await waitForTextMatching(page.getByTestId("current-model"), /loaded locally/);

    await page.getByTestId("setup-toggle").click();

    await waitForCount(page.getByTestId("load"), 0);
    await waitForTextMatching(page.getByTestId("current-model"), /MiniCPM5 2B · 1\.56 GB · loaded/);
  });

  it("keeps a load failure readable while the setup is hidden", async () => {
    const worker = await setup();

    await page.getByTestId("load").click();
    await emit(worker, { type: "error", message: "No GPU adapter." });
    await waitForText(page.getByTestId("support-text"), "No GPU adapter.");

    await page.getByTestId("setup-toggle").click();

    await waitForCount(page.getByTestId("load"), 0);
    await waitForTextMatching(page.getByTestId("current-model"), /load failed/);
    await waitForText(page.getByTestId("support-text"), "No GPU adapter.");
  });
});

describe("switching tiers", () => {
  it("offers the switch once a model is ready and loads the new tier", async () => {
    const worker = await setup();
    await loadDefaultModel(worker);

    const select = page.getByRole("combobox", { name: "Model" });
    await waitForDisabled(select, false);
    await select.click();
    await page.getByRole("option", { name: /Qwen3 0\.6B/ }).click();

    // The resident tier stays on the line while the select already points away.
    await waitForTextMatching(page.getByTestId("current-model"), /MiniCPM5 2B · 1\.56 GB · loaded/);
    await waitForText(page.getByTestId("load"), "switch to Qwen3 0.6B");

    await page.getByTestId("load").click();
    expect(worker.requests.at(-1)).toEqual({
      type: "load",
      modelId: "qwen3-0.6b",
      useLocal: false,
    });
    await waitForTextMatching(page.getByTestId("current-model"), /Qwen3 0\.6B · 639 MB · loading/);
    await waitForDisabled(page.getByTestId("run"), true);

    await emit(worker, {
      type: "ready",
      warmupMs: 42,
      modelId: "qwen3-0.6b",
      modelName: "Qwen3 0.6B",
    });
    await waitForTextMatching(page.getByTestId("current-model"), /Qwen3 0\.6B · 639 MB · loaded/);
    await waitForText(page.getByTestId("load"), "model ready");
    await waitForDisabled(page.getByTestId("load"), true);
    await waitForDisabled(page.getByTestId("run"), false);
  });

  it("marks a tier as cached once this browser has loaded it", async () => {
    const worker = await setup();

    await page.getByRole("combobox", { name: "Model" }).click();
    await waitForCount(page.getByRole("option"), 3);
    await waitForCount(page.getByTestId("cached-badge"), 0);
    // Selecting the current tier again closes the list without changing it.
    await page.getByRole("option", { name: /MiniCPM5 2B/ }).click();

    await loadDefaultModel(worker);

    await page.getByRole("combobox", { name: "Model" }).click();
    await waitForCount(page.getByRole("option"), 3);
    await waitForCount(page.getByTestId("cached-badge"), 1);
    await waitForTextMatching(
      page.getByRole("option", { name: /MiniCPM5 2B/ }),
      /desktop default\s*cached/,
    );

    // The record outlives the page, so a later visit shows the marker too.
    expect(window.localStorage.getItem("decidekit.loaded-tiers")).toContain("minicpm5-2b");
  });

  it("drops the previous readouts when the tier changes", async () => {
    const worker = await setup();
    await loadDefaultModel(worker);
    await pickReadout("Both");

    await page.getByTestId("run").click();
    await emit(worker, {
      type: "direct",
      totalMs: 900,
      inputTokens: 120,
      readouts: 1,
      options: [
        { label: "A", description: "Account access support", probability: 0.7, logit: -0.1 },
        { label: "B", description: "Billing support", probability: 0.2, logit: -1.5 },
        { label: "C", description: "Close as resolved", probability: 0.1, logit: -2.1 },
      ],
    });
    await waitForTextMatching(page.getByTestId("direct-output"), /Account access support/);

    // A tier cannot be swapped while a comparison is in flight.
    await waitForDisabled(page.getByRole("combobox", { name: "Model" }), true);

    await emit(worker, {
      type: "complete",
      generation: {
        generationMs: 5400,
        inputTokens: 120,
        ttftMs: 300,
        generatedTokens: 30,
        generatedText:
          '{"A: Account access support": 0.7, "B: Billing support": 0.2, "C: Close as resolved": 0.1}',
        valid: true,
        choice: "A",
        choiceDescription: "Account access support",
        validationError: "",
        strippedFence: false,
      },
    });
    await waitForTextMatching(page.getByTestId("generation-verdict"), /valid JSON/);

    await page.getByRole("combobox", { name: "Model" }).click();
    await page.getByRole("option", { name: /Qwen3\.5 4B/ }).click();
    await page.getByTestId("load").click();

    await waitForTextMatching(
      page.getByTestId("current-model"),
      /Qwen3\.5 4B · 3\.01 GB · loading/,
    );
    await waitForCount(page.getByText("waiting for a run"), 2);
    expect(page.getByTestId("direct-output").elements()).toHaveLength(0);
    expect(page.getByTestId("generation-verdict").elements()).toHaveLength(0);
  });
});

describe("decision editing", () => {
  it("keeps the option count between two and twenty", async () => {
    await setup();

    const remove = page.getByRole("button", { name: /remove/i });
    const add = page.getByRole("button", { name: /add/i });

    await waitForText(page.getByTestId("option-count"), "3 / 20");
    await remove.click();
    await waitForText(page.getByTestId("option-count"), "2 / 20");
    await waitForDisabled(remove, true);

    // Clicks must land in order: each one appends the next row, so they cannot
    // be fired concurrently.
    // oxlint-disable-next-line eslint/no-await-in-loop
    for (let index = 0; index < 18; index += 1) await add.click();
    await waitForText(page.getByTestId("option-count"), "20 / 20");
    await waitForCount(page.getByTestId("option-row"), 20);
    await waitForDisabled(add, true);
  });

  it("prefills an example decision", async () => {
    await setup();

    await page.getByTestId("preset-email").click();

    await waitForFieldValueMatching(page.getByLabelText("State"), /payroll/);
    await waitForFieldValue(
      page.getByLabelText("Question"),
      "How should this email be classified?",
    );
    await waitForFieldValue(page.getByLabelText("Option A"), "Legitimate");
  });

  it("refuses a decision with an empty option and never calls the worker", async () => {
    const worker = await setup();
    await loadDefaultModel(worker);

    await page.getByLabelText("Option B").fill("   ");
    await page.getByTestId("run").click();

    await waitForText(
      page.getByTestId("support-text"),
      "State, question and every option must be nonempty.",
    );
    expect(worker.requests.some((request) => request.type === "compare")).toBe(false);
  });
});

describe("comparison run", () => {
  it("sends the trimmed decision and renders both readouts", async () => {
    const worker = await setup();
    await loadDefaultModel(worker);
    await pickReadout("Both");

    await page.getByTestId("run").click();
    expect(worker.requests.at(-1)).toEqual({
      type: "compare",
      data: {
        state: DEFAULT_DECISION.state,
        question: DEFAULT_DECISION.question,
        options: DEFAULT_DECISION.options,
      },
      readout: "both",
    });

    await emit(worker, {
      type: "direct",
      totalMs: 900,
      inputTokens: 120,
      readouts: 1,
      options: [
        { label: "A", description: "Account access support", probability: 0.7, logit: -0.1 },
        { label: "B", description: "Billing support", probability: 0.2, logit: -1.5 },
        { label: "C", description: "Close as resolved", probability: 0.1, logit: -2.1 },
      ],
    });

    await waitForTextMatching(page.getByTestId("direct-output"), /Account access support/);
    await waitForTextMatching(page.getByTestId("direct-output"), /0\.700/);
    await waitForTextMatching(page.getByTestId("direct-output"), /0\.200/);
    await waitForTextMatching(page.getByTestId("direct-output"), /0\.100/);
    await vi.waitFor(async () => {
      const bar = await page.getByTestId("bar-A").findElement();
      expect(bar.getAttribute("style")).toContain("width: 70%");
    });

    await emit(worker, { type: "generation-start" });
    await emit(worker, { type: "generation-update", text: '{"A: Account', tokens: 4, ttftMs: 300 });
    await waitForTextMatching(page.getByTestId("generation-output"), /\{"A: Account/);

    await emit(worker, {
      type: "complete",
      generation: {
        generationMs: 5400,
        inputTokens: 120,
        ttftMs: 300,
        generatedTokens: 30,
        generatedText:
          '{"A: Account access support": 0.7, "B: Billing support": 0.2, "C: Close as resolved": 0.1}',
        valid: true,
        choice: "A",
        choiceDescription: "Account access support",
        validationError: "",
        strippedFence: false,
      },
    });

    await waitForTextMatching(page.getByTestId("generation-verdict"), /valid JSON · top choice A/);
    await waitForText(page.getByTestId("ratio"), "6.00× generation / direct");
    await waitForDisabled(page.getByTestId("run"), false);
  });

  it("shows an unusable generation instead of hiding it", async () => {
    const worker = await setup();
    await loadDefaultModel(worker);
    await pickReadout("JSON only");

    await page.getByTestId("run").click();
    await emit(worker, {
      type: "complete",
      generation: {
        generationMs: 1200,
        inputTokens: 120,
        ttftMs: null,
        generatedTokens: 0,
        generatedText: "",
        valid: false,
        choice: null,
        choiceDescription: null,
        validationError: "expected one JSON object",
        strippedFence: false,
      },
    });

    await waitForText(
      page.getByTestId("generation-verdict"),
      "unusable output · expected one JSON object",
    );
  });

  it("says so when a usable answer had to be unwrapped from a code fence", async () => {
    const worker = await setup();
    await loadDefaultModel(worker);
    await pickReadout("JSON only");

    await page.getByTestId("run").click();
    await emit(worker, {
      type: "complete",
      generation: {
        generationMs: 2600,
        inputTokens: 120,
        ttftMs: 300,
        generatedTokens: 40,
        generatedText:
          '```json\n{"A: Account access support": 0.5, "B: Billing support": 0.4, "C: Close as resolved": 0.1}\n```',
        valid: true,
        choice: "A",
        choiceDescription: "Account access support",
        validationError: "",
        strippedFence: true,
      },
    });

    await waitForText(
      page.getByTestId("generation-verdict"),
      "valid JSON · code fence stripped · top choice A",
    );
  });

  it("keeps the run available when a comparison fails after a successful load", async () => {
    const worker = await setup();
    await loadDefaultModel(worker);

    await page.getByTestId("run").click();
    await emit(worker, {
      type: "error",
      message: "The model did not return valid option logits for A, B, C.",
    });

    await waitForTextMatching(
      page.getByTestId("support-text"),
      /did not return valid option logits/,
    );
    await waitForDisabled(page.getByTestId("run"), false);
  });
});

describe("readout selection", () => {
  const OPTIONS = [
    { label: "A", description: "Account access support", probability: 0.7, logit: -0.1 },
    { label: "B", description: "Billing support", probability: 0.2, logit: -1.5 },
    { label: "C", description: "Close as resolved", probability: 0.1, logit: -2.1 },
  ];

  it("starts on choices only and runs just that path", async () => {
    const worker = await setup();
    await loadDefaultModel(worker);

    await waitForChecked(page.getByRole("radio", { name: "Choices only" }), true);
    await waitForText(page.getByTestId("run"), "run the choices");

    await page.getByTestId("run").click();
    expect(worker.requests.at(-1)).toEqual({
      type: "compare",
      data: {
        state: DEFAULT_DECISION.state,
        question: DEFAULT_DECISION.question,
        options: DEFAULT_DECISION.options,
      },
      readout: "choices",
    });

    await emit(worker, {
      type: "direct",
      totalMs: 900,
      inputTokens: 120,
      readouts: 1,
      options: OPTIONS,
    });
    await emit(worker, { type: "complete", generation: null });

    await waitForTextMatching(page.getByTestId("direct-output"), /Account access support/);
    // The generation lane is not rendered at all, not merely left empty.
    await waitForCount(page.getByTestId("generation-output"), 0);
    await waitForCount(page.getByTestId("generation-verdict"), 0);
    await waitForCount(page.getByText("waiting for a run"), 0);
    // The lane already shows this wall time, so the bar is not rendered at all.
    await waitForCount(page.getByTestId("ratio"), 0);
    await waitForDisabled(page.getByTestId("run"), false);
  });

  it("computes and shows only the generation when that mode is picked", async () => {
    const worker = await setup();
    await loadDefaultModel(worker);

    await pickReadout("JSON only");
    await waitForText(page.getByTestId("run"), "run the json");

    await page.getByTestId("run").click();
    expect(worker.requests.at(-1)).toMatchObject({ type: "compare", readout: "json" });
    await emit(worker, { type: "generation-start" });
    await emit(worker, {
      type: "complete",
      generation: {
        generationMs: 2600,
        inputTokens: 120,
        ttftMs: 300,
        generatedTokens: 40,
        generatedText: '{"A: Account access support": 1}',
        valid: true,
        choice: "A",
        choiceDescription: "Account access support",
        validationError: "",
        strippedFence: false,
      },
    });

    await waitForCount(page.getByTestId("direct-output"), 0);
    await waitForTextMatching(page.getByTestId("generation-verdict"), /valid JSON · top choice A/);
    await waitForCount(page.getByTestId("ratio"), 0);
    await waitForDisabled(page.getByTestId("run"), false);
  });

  it("keeps the selected readout when you leave the lab and come back", async () => {
    await setup();

    await pickReadout("JSON only");
    await waitForText(page.getByTestId("run"), "run the json");

    await mainNav().getByRole("link", { name: "About" }).click();
    await waitForTextMatching(page.getByRole("heading", { level: 1 }), /live, local experiment/);
    await mainNav().getByRole("link", { name: "Lab" }).click();

    await waitForText(page.getByTestId("run"), "run the json");
  });
});

describe("routing", () => {
  it("navigates between the lab and the about page", async () => {
    await setup();

    await mainNav().getByRole("link", { name: "About" }).click();
    await waitForTextMatching(page.getByRole("heading", { level: 1 }), /live, local experiment/);
    expect(window.location.pathname).toBe("/about");

    await page.getByRole("link", { name: "Open the lab" }).click();
    await waitForTextMatching(page.getByRole("heading", { level: 1 }), /Load the model once/);
    expect(window.location.pathname).toBe("/");
  });

  it("serves the about page on a direct visit", async () => {
    await setupAt("/about");

    await waitForTextMatching(page.getByRole("heading", { level: 1 }), /live, local experiment/);
    expect(page.getByTestId("run").elements()).toHaveLength(0);
    expect(page.getByTestId("option-row").elements()).toHaveLength(0);
  });

  it("keeps a loaded model when you visit the about page and come back", async () => {
    const worker = await setup();
    await loadDefaultModel(worker);

    await mainNav().getByRole("link", { name: "About" }).click();
    await waitForTextMatching(page.getByRole("heading", { level: 1 }), /live, local experiment/);

    await mainNav().getByRole("link", { name: "Lab" }).click();
    await waitForDisabled(page.getByTestId("run"), false);
    await waitForTextMatching(page.getByTestId("support-text"), /MiniCPM5 2B is loaded locally/);
  });

  it("keeps the edited decision when you leave the lab and come back", async () => {
    await setup();

    await page.getByTestId("preset-email").click();
    await waitForFieldValue(
      page.getByLabelText("Question"),
      "How should this email be classified?",
    );

    await mainNav().getByRole("link", { name: "About" }).click();
    await waitForTextMatching(page.getByRole("heading", { level: 1 }), /live, local experiment/);
    await mainNav().getByRole("link", { name: "Lab" }).click();

    await waitForFieldValue(
      page.getByLabelText("Question"),
      "How should this email be classified?",
    );
    await waitForFieldValue(page.getByLabelText("Option A"), "Legitimate");
  });

  it("shows a not-found page for an unknown path", async () => {
    await setupAt("/nope");

    await waitForTextMatching(page.getByRole("heading", { level: 1 }), /does not exist/);
  });

  it("keeps the collapsed setup panel when you leave the lab and come back", async () => {
    await setup();

    await page.getByTestId("setup-toggle").click();
    await waitForCount(page.getByTestId("load"), 0);

    await mainNav().getByRole("link", { name: "About" }).click();
    await waitForTextMatching(page.getByRole("heading", { level: 1 }), /live, local experiment/);
    await mainNav().getByRole("link", { name: "Lab" }).click();

    await waitForCount(page.getByTestId("load"), 0);
    await waitForTextMatching(page.getByTestId("current-model"), /MiniCPM5 2B/);
  });
});
