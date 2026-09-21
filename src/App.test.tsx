import { page, type Locator } from "vitest/browser";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { App } from "@/App";
import type { WebGPUProbe, WorkerLike } from "@/hooks/useInference";
import type { WorkerEvent, WorkerRequest } from "@/lib/inference/protocol";
import { DEFAULT_DECISION } from "@/lib/presets";

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
    return this as unknown as WorkerLike;
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
async function waitForText(locator: Locator, matcher: string | RegExp): Promise<void> {
  await vi.waitFor(async () => {
    const text = await textOf(locator);
    if (typeof matcher === "string") expect(text).toBe(matcher);
    else expect(text).toMatch(matcher);
  });
}

async function waitForDisabled(locator: Locator, disabled: boolean): Promise<void> {
  await vi.waitFor(async () => {
    const element = (await locator.findElement()) as HTMLButtonElement;
    expect(element.disabled).toBe(disabled);
  });
}

async function waitForCount(locator: Locator, count: number): Promise<void> {
  await vi.waitFor(() => {
    expect(locator.elements()).toHaveLength(count);
  });
}

async function waitForFieldValue(
  locator: Locator,
  matcher: string | RegExp,
): Promise<void> {
  await vi.waitFor(async () => {
    const element = (await locator.findElement()) as HTMLInputElement | HTMLTextAreaElement;
    if (typeof matcher === "string") expect(element.value).toBe(matcher);
    else expect(element.value).toMatch(matcher);
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

function setup(probe: WebGPUProbe = READY_PROBE) {
  const worker = new FakeWorker();
  render(<App createWorker={() => worker.asWorkerLike()} probe={probe} />);
  return worker;
}

/** Loads the default tier and waits until both paths can run. */
async function loadDefaultModel(worker: FakeWorker): Promise<void> {
  await page.getByTestId("load").click();
  await emit(worker, { type: "ready", warmupMs: 88, modelId: "minicpm5-2b", modelName: "MiniCPM5 2B" });
  await waitForDisabled(page.getByTestId("run"), false);
}

describe("compatibility check", () => {
  it("reports a usable WebGPU before anything is downloaded", async () => {
    setup();

    await waitForText(page.getByTestId("support-text"), /WebGPU is ready/);
    await waitForDisabled(page.getByTestId("load"), false);
  });

  it("blocks loading when WebGPU is missing", async () => {
    setup(UNSUPPORTED_PROBE);

    await waitForText(page.getByTestId("support-text"), /WebGPU is unavailable/);
    await waitForDisabled(page.getByTestId("load"), true);
  });

  it("keeps both result lanes empty until a run happens", async () => {
    setup();

    await waitForDisabled(page.getByTestId("run"), true);
    expect(await page.getByText("waiting for a run").elements()).toHaveLength(2);
  });
});

describe("model setup", () => {
  it("loads the default tier and reports each setup phase", async () => {
    const worker = setup();

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

    await emit(worker, { type: "ready", warmupMs: 88, modelId: "minicpm5-2b", modelName: "MiniCPM5 2B" });
    await waitForText(page.getByTestId("warmup-value"), "0.088 s");
    await waitForText(page.getByTestId("support-text"), /MiniCPM5 2B is loaded locally/);
    await waitForDisabled(page.getByTestId("run"), false);
    await waitForDisabled(page.getByTestId("load"), true);
  });

  it("loads whichever tier the visitor selected", async () => {
    const worker = setup();

    await page.getByRole("combobox", { name: "Model" }).click();
    await page.getByRole("option", { name: /Qwen3 0.6B/ }).click();
    await page.getByTestId("load").click();

    expect(worker.requests).toEqual([{ type: "load", modelId: "qwen3-0.6b", useLocal: false }]);
  });

  it("surfaces a worker failure and allows a retry", async () => {
    const worker = setup();

    await page.getByTestId("load").click();
    await emit(worker, { type: "error", message: "No GPU adapter." });

    await waitForText(page.getByTestId("support-text"), "No GPU adapter.");
    await waitForDisabled(page.getByTestId("load"), false);

    await emitWorkerError(worker, "Worker crashed");
    await waitForText(page.getByTestId("support-text"), /Worker failed: Worker crashed/);
  });
});

describe("decision editing", () => {
  it("keeps the option count between two and twenty", async () => {
    setup();

    const remove = page.getByRole("button", { name: /remove/i });
    const add = page.getByRole("button", { name: /add/i });

    await waitForText(page.getByTestId("option-count"), "3 / 20");
    await remove.click();
    await waitForText(page.getByTestId("option-count"), "2 / 20");
    await waitForDisabled(remove, true);

    for (let index = 0; index < 18; index += 1) await add.click();
    await waitForText(page.getByTestId("option-count"), "20 / 20");
    await waitForCount(page.getByTestId("option-row"), 20);
    await waitForDisabled(add, true);
  });

  it("prefills an example decision", async () => {
    setup();

    await page.getByTestId("preset-email").click();

    await waitForFieldValue(page.getByLabelText("State"), /payroll/);
    await waitForFieldValue(page.getByLabelText("Question"), "How should this email be classified?");
    await waitForFieldValue(page.getByLabelText("Option A"), "Legitimate");
  });

  it("refuses a decision with an empty option and never calls the worker", async () => {
    const worker = setup();
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
    const worker = setup();
    await loadDefaultModel(worker);

    await page.getByTestId("run").click();
    expect(worker.requests.at(-1)).toEqual({
      type: "compare",
      data: {
        state: DEFAULT_DECISION.state,
        question: DEFAULT_DECISION.question,
        options: DEFAULT_DECISION.options,
      },
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

    await waitForText(page.getByTestId("direct-output"), /Account access support/);
    await waitForText(page.getByTestId("direct-output"), /0\.700/);
    await waitForText(page.getByTestId("direct-output"), /0\.200/);
    await waitForText(page.getByTestId("direct-output"), /0\.100/);
    await vi.waitFor(async () => {
      const bar = await page.getByTestId("bar-A").findElement();
      expect(bar.getAttribute("style")).toContain("width: 70%");
    });

    await emit(worker, { type: "generation-start" });
    await emit(worker, { type: "generation-update", text: '{"A: Account', tokens: 4, ttftMs: 300 });
    await waitForText(page.getByTestId("generation-output"), /\{"A: Account/);

    await emit(worker, {
      type: "complete",
      directMs: 900,
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
    });

    await waitForText(page.getByTestId("generation-verdict"), /valid JSON · top choice A/);
    await waitForText(page.getByTestId("ratio"), "6.00× generation / direct");
    await waitForDisabled(page.getByTestId("run"), false);
  });

  it("shows an unusable generation instead of hiding it", async () => {
    const worker = setup();
    await loadDefaultModel(worker);

    await page.getByTestId("run").click();
    await emit(worker, {
      type: "complete",
      directMs: 900,
      generationMs: 1200,
      inputTokens: 120,
      ttftMs: null,
      generatedTokens: 0,
      generatedText: "",
      valid: false,
      choice: null,
      choiceDescription: null,
      validationError: "expected one JSON object",
    });

    await waitForText(
      page.getByTestId("generation-verdict"),
      "unusable output · expected one JSON object",
    );
  });

  it("keeps the run available when a comparison fails after a successful load", async () => {
    const worker = setup();
    await loadDefaultModel(worker);

    await page.getByTestId("run").click();
    await emit(worker, {
      type: "error",
      message: "The model did not return valid option logits for A, B, C.",
    });

    await waitForText(page.getByTestId("support-text"), /did not return valid option logits/);
    await waitForDisabled(page.getByTestId("run"), false);
  });
});
