/**
 * Remembers which tiers this browser has already loaded, so the model list can
 * say which switch will not need the network again.
 *
 * A page cannot ask the HTTP cache whether it holds a URL, so this is a record
 * of what happened rather than a live reading: a tier is remembered once a load
 * finished, which is when its weights went through the cache. The browser may
 * still evict an entry, so callers treat it as a hint.
 */

import { isModelId, type ModelId } from "@/lib/models";

const STORAGE_KEY = "decidekit.loaded-tiers";

/** The slice of `Storage` this module needs, so tests can pass a fake. */
export type StorageLike = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    // Storage can be blocked outright, e.g. by cookie settings.
    return null;
  }
}

export function readCachedTiers(storage: StorageLike | null = defaultStorage()): ModelId[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is ModelId => typeof id === "string" && isModelId(id));
  } catch {
    return [];
  }
}

export function rememberTier(
  id: ModelId,
  storage: StorageLike | null = defaultStorage(),
): ModelId[] {
  const tiers = readCachedTiers(storage);
  if (tiers.includes(id)) return tiers;
  const next = [...tiers, id];
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // A full or read-only store must not fail a load that already succeeded.
  }
  return next;
}
