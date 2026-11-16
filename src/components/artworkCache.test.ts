import { beforeEach, afterEach, expect, it, vi } from "vitest";

const cover = vi.hoisted(() => vi.fn());
vi.mock("../api", () => ({ api: { cover } }));
beforeEach(() => {
  vi.resetModules();
  cover.mockReset();
  cover.mockImplementation(async (id: string) => "image:" + id);
  vi.stubGlobal(
    "Image",
    class {
      src = "";
      naturalWidth = 512;
      naturalHeight = 512;
      async decode() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

it("coalesces artwork requests, keeps pinned covers and evicts unused decoded memory", async () => {
  const cache = await import("./artworkCache");
  const release = cache.pinArtwork("kept");
  const first = cache.loadArtwork("kept", "track", 512);
  expect(cache.loadArtwork("kept", "other-copy", 512)).toBe(first);
  await first;
  for (let i = 0; i < 40; i++)
    await cache.loadArtwork("old-" + i, "id-" + i, 512);
  expect(cache.cachedArtwork("kept")).toBe("image:track");
  expect(cache.cachedArtwork("old-0")).toBeUndefined();
  expect(cache.artworkCacheStats().bytes).toBeLessThanOrEqual(32 * 1024 * 1024);
  expect(cache.artworkCacheStats().entries).toBe(32);
  release();
});

it("bounds simultaneous decoding and discards a queued cover when its row leaves", async () => {
  const cache = await import("./artworkCache");
  const resolves: Array<(url: string) => void> = [];
  cover.mockImplementation(
    () => new Promise<string>((resolve) => resolves.push(resolve)),
  );
  const active = Array.from({ length: 4 }, (_, i) =>
    cache.loadArtwork("busy-" + i, "busy-" + i, 128),
  );
  const unpin = cache.pinArtwork("gone");
  const queued = cache.loadArtwork("gone", "gone", 128);
  const rejected = expect(queued).rejects.toThrow("no longer visible");
  expect(cover).toHaveBeenCalledTimes(4);
  unpin();
  await rejected;
  resolves.forEach((resolve) => resolve("image:ready"));
  await Promise.all(active);
  expect(cover).toHaveBeenCalledTimes(4);
  expect(cache.artworkCacheStats()).toMatchObject({ running: 0, pending: 0 });
});
