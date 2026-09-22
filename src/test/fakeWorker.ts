/**
 * Stands in for the inference worker so tests run without a GPU, a network
 * download or a real engine.
 *
 * A test drives a run by hand: `requests` records what the page sent, `emit`
 * feeds one worker event back, and `emitWorkerError` fails the worker itself as
 * opposed to sending an error message from inside it.
 *
 * This is test infrastructure, not shipped code; `contracts.test.ts` skips this
 * directory for that reason.
 */

import type { WorkerLike } from "@/hooks/useInference";
import type { WorkerEvent, WorkerRequest } from "@/lib/inference/protocol";

export class FakeWorker {
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

  compares(): WorkerRequest[] {
    return this.requests.filter((request) => request.type === "compare");
  }
}
