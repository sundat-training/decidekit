import { describe, expect, it } from "vitest";

import { DownloadTracker } from "@/lib/download";

describe("download tracker", () => {
  it("starts idle", () => {
    const tracker = new DownloadTracker();
    expect(tracker.current).toEqual({
      percent: null,
      value: "—",
      detail: "starts only when you click load",
    });
    expect(tracker.observedTransfer).toBe(false);
  });

  it("sums several files into one percentage", () => {
    const tracker = new DownloadTracker();
    tracker.update({ status: "progress", file: "a", loaded: 50, total: 100 });
    const snapshot = tracker.update({ status: "progress", file: "b", loaded: 0, total: 100 });
    expect(snapshot.percent).toBeCloseTo(25);
    expect(snapshot.value).toBe("25%");
    expect(tracker.observedTransfer).toBe(true);
  });

  it("uses the loader text as the detail line when present", () => {
    const tracker = new DownloadTracker();
    const snapshot = tracker.update({
      status: "progress",
      file: "a",
      loaded: 10,
      total: 10,
      text: "10% of model downloaded or read from cache",
    });
    expect(snapshot.detail).toBe("10% of model downloaded or read from cache");
    expect(snapshot.percent).toBe(100);
  });

  it("counts a finished file as fully transferred", () => {
    const tracker = new DownloadTracker();
    tracker.update({ status: "progress", file: "a", loaded: 20, total: 100 });
    const snapshot = tracker.update({ status: "done", file: "a" });
    expect(snapshot.percent).toBe(100);
  });

  it("reports a cache check before any byte count arrives", () => {
    const tracker = new DownloadTracker();
    const snapshot = tracker.update({ status: "initiate", file: "model.gguf" });
    expect(snapshot.value).toBe("cache check");
    expect(snapshot.detail).toBe("model.gguf");
    expect(snapshot.percent).toBeNull();
  });

  it("marks a fully cached model without network transfer", () => {
    const tracker = new DownloadTracker();
    const snapshot = tracker.markCached();
    expect(snapshot.value).toBe("cached");
    expect(snapshot.detail).toBe("no network transfer observed");
    expect(snapshot.percent).toBe(100);
  });

  it("does not claim a cache hit when bytes were observed", () => {
    const tracker = new DownloadTracker();
    tracker.update({ status: "progress", file: "a", loaded: 5, total: 100 });
    const snapshot = tracker.markCached();
    expect(snapshot.value).toBe("5%");
  });

  it("reports a finished transfer as full", () => {
    const tracker = new DownloadTracker();
    tracker.update({ status: "progress", file: "a", loaded: 20, total: 100 });
    const snapshot = tracker.markComplete();
    expect(snapshot.value).toBe("100%");
    expect(snapshot.percent).toBe(100);
  });

  it("resets for the next load", () => {
    const tracker = new DownloadTracker();
    tracker.update({ status: "progress", file: "a", loaded: 5, total: 100 });
    tracker.reset();
    expect(tracker.observedTransfer).toBe(false);
    expect(tracker.current.value).toBe("—");
  });
});
