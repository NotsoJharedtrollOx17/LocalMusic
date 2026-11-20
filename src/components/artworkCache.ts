import { api } from "../api";

const budget = 32 * 1024 * 1024;
const entries = new Map<string, { url: string; bytes: number }>();
const pending = new Map<string, Promise<string>>();
const pins = new Map<string, number>();
const priorities = new Map<string, number>();
const viewers = new Map<string, number>();
export function watchArtwork(key: string) {
  viewers.set(key, (viewers.get(key) ?? 0) + 1);
  return () => {
    const count = (viewers.get(key) ?? 1) - 1;
    if (count) viewers.set(key, count);
    else {
      viewers.delete(key);
      cancelQueued(key);
    }
  };
}
function cancelQueued(key: string) {
  if (viewers.has(key) || pins.has(key)) return;
  const queued = waiting.get(key);
  if (queued) {
    waiting.delete(key);
    queued.reject(new Error("Artwork no longer visible"));
  }
}
let bytes = 0,
  running = 0;
const waiting = new Map<
  string,
  { resolve: () => void; reject: (error: Error) => void }
>();
function prune() {
  for (const [key, entry] of entries) {
    if (bytes <= budget) break;
    if (pins.has(key)) continue;
    entries.delete(key);
    bytes -= entry.bytes;
  }
}
export function pinArtwork(key: string, priority = false) {
  pins.set(key, (pins.get(key) ?? 0) + 1);
  if (priority) priorities.set(key, (priorities.get(key) ?? 0) + 1);
  return () => {
    if (priority) {
      const count = (priorities.get(key) ?? 1) - 1;
      if (count) priorities.set(key, count);
      else priorities.delete(key);
    }
    const count = (pins.get(key) ?? 1) - 1;
    if (count) pins.set(key, count);
    else {
      pins.delete(key);
      cancelQueued(key);
    }
    prune();
  };
}
export function cachedArtwork(key: string) {
  const entry = entries.get(key);
  if (entry) {
    entries.delete(key);
    entries.set(key, entry);
  }
  return entry?.url;
}
export function loadArtwork(
  key: string,
  id: string,
  size: number,
): Promise<string> {
  const cached = cachedArtwork(key);
  if (cached) return Promise.resolve(cached);
  const existing = pending.get(key);
  if (existing) return existing;
  const request = (async () => {
    if (running >= 4)
      await new Promise<void>((resolve, reject) =>
        waiting.set(key, { resolve, reject }),
      );
    else running++;
    try {
      const url = await api.cover(id, size);
      const image = new Image();
      image.src = url;
      await image.decode();
      const cost = image.naturalWidth * image.naturalHeight * 4;
      if (cost <= budget) {
        entries.set(key, { url, bytes: cost });
        bytes += cost;
        prune();
        // Extremely large visible surfaces cannot grow the cache beyond its cap.
        // The requesting element still receives this decoded URL directly.
        if (bytes > budget) {
          entries.delete(key);
          bytes -= cost;
        }
      }
      return url;
    } finally {
      running--;
      const keys = Array.from(waiting.keys());
      const visibleKey = keys.find((key) => priorities.has(key)) ??
        keys.find((key) => pins.has(key));
      const next = visibleKey
        ? ([visibleKey, waiting.get(visibleKey)!] as const)
        : waiting.entries().next().value;
      if (next) {
        waiting.delete(next[0]);
        running++;
        next[1].resolve();
      }
    }
  })().finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}
/** Diagnostic counters; never contain listening or source data. */
export function artworkCacheStats() {
  return {
    bytes,
    entries: entries.size,
    pending: pending.size,
    running,
    budget,
  };
}
