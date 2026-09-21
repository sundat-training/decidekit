import { describe, expect, it } from "vitest";

import { readCachedTiers, rememberTier, type StorageLike } from "@/lib/tierCache";

function fakeStorage(
  initial: Record<string, string> = {},
): StorageLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

function brokenStorage(): StorageLike {
  return {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("quota exceeded");
    },
  };
}

describe("tier cache", () => {
  it("starts empty and reports nothing cached", () => {
    expect(readCachedTiers(fakeStorage())).toEqual([]);
  });

  it("remembers a tier and reads it back on a later visit", () => {
    const storage = fakeStorage();

    expect(rememberTier("minicpm5-2b", storage)).toEqual(["minicpm5-2b"]);
    expect(readCachedTiers(storage)).toEqual(["minicpm5-2b"]);

    expect(rememberTier("qwen3.5-4b", storage)).toEqual(["minicpm5-2b", "qwen3.5-4b"]);
    expect(readCachedTiers(storage)).toEqual(["minicpm5-2b", "qwen3.5-4b"]);
  });

  it("keeps one entry per tier", () => {
    const storage = fakeStorage();

    rememberTier("qwen3-0.6b", storage);
    expect(rememberTier("qwen3-0.6b", storage)).toEqual(["qwen3-0.6b"]);
  });

  it("ignores stored values that are not a list of known tiers", () => {
    expect(readCachedTiers(fakeStorage({ "decidekit.loaded-tiers": '{"tier":"x"}' }))).toEqual([]);
    expect(readCachedTiers(fakeStorage({ "decidekit.loaded-tiers": "not json" }))).toEqual([]);
    expect(
      readCachedTiers(fakeStorage({ "decidekit.loaded-tiers": '["gone-1b","minicpm5-2b",7]' })),
    ).toEqual(["minicpm5-2b"]);
  });

  it("survives storage that refuses to read or write", () => {
    expect(readCachedTiers(brokenStorage())).toEqual([]);
    expect(() => rememberTier("qwen3-0.6b", brokenStorage())).not.toThrow();
    expect(rememberTier("qwen3-0.6b", brokenStorage())).toEqual(["qwen3-0.6b"]);
  });

  it("treats missing storage as nothing cached", () => {
    expect(readCachedTiers(null)).toEqual([]);
    expect(rememberTier("qwen3-0.6b", null)).toEqual(["qwen3-0.6b"]);
  });
});
