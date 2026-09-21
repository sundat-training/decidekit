/**
 * Aggregates the per-file progress events the loader emits into the single
 * download meter the setup panel shows.
 */

export interface LoaderProgressEvent {
  status: string;
  file?: string;
  loaded?: number;
  total?: number;
  text?: string;
}

export interface DownloadSnapshot {
  /** 0–100 while bytes are moving, `null` before anything is measured. */
  percent: number | null;
  /** Short value for the meter label. */
  value: string;
  /** Sentence under the meter. */
  detail: string;
}

const IDLE: DownloadSnapshot = {
  percent: null,
  value: "—",
  detail: "starts only when you click load",
};

export class DownloadTracker {
  private readonly files = new Map<string, { loaded: number; total: number }>();
  private snapshot: DownloadSnapshot = IDLE;

  /** True once any byte count has arrived, i.e. the model was not fully cached. */
  get observedTransfer(): boolean {
    return this.files.size > 0;
  }

  get current(): DownloadSnapshot {
    return this.snapshot;
  }

  update(event: LoaderProgressEvent): DownloadSnapshot {
    if (!event.file) return this.snapshot;

    if (
      event.status === "progress" &&
      Number.isFinite(event.loaded) &&
      Number.isFinite(event.total)
    ) {
      this.files.set(event.file, { loaded: event.loaded ?? 0, total: event.total ?? 0 });
    } else if (event.status === "done" && this.files.has(event.file)) {
      const item = this.files.get(event.file)!;
      this.files.set(event.file, { loaded: item.total, total: item.total });
    }

    const totals = [...this.files.values()].reduce(
      (sum, item) => ({ loaded: sum.loaded + item.loaded, total: sum.total + item.total }),
      { loaded: 0, total: 0 },
    );

    if (totals.total > 0) {
      const percent = Math.min(100, (totals.loaded / totals.total) * 100);
      this.snapshot = {
        percent,
        value: `${percent.toFixed(0)}%`,
        detail: event.text || "model files and WebGPU runtime",
      };
    } else if (event.status === "initiate") {
      this.snapshot = { percent: null, value: "cache check", detail: event.file };
    }

    return this.snapshot;
  }

  /** The model came back without network transfer, so it was served from cache. */
  markCached(): DownloadSnapshot {
    if (this.files.size === 0) {
      this.snapshot = {
        percent: 100,
        value: "cached",
        detail: "no network transfer observed",
      };
    }
    return this.snapshot;
  }

  markComplete(): DownloadSnapshot {
    this.snapshot = { ...this.snapshot, percent: 100, value: "100%" };
    return this.snapshot;
  }

  reset(): void {
    this.files.clear();
    this.snapshot = IDLE;
  }
}
