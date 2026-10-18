import { describe, expect, it } from "vitest";
import { PlaybackUpdates } from "./PlaybackUpdates";
import type { PlaybackSnapshot } from "../types";

const snapshot = (positionMs: number) =>
  ({ trackId: "song", positionMs }) as PlaybackSnapshot;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
describe("native playback update ordering", () => {
  it("keeps the preview until a small forward or backward seek has fresh state", async () => {
    for (const target of [9900, 10100]) {
      const updates = new PlaybackUpdates(),
        values: number[] = [];
      updates.add((s) => values.push(s.positionMs));
      updates.push(snapshot(10000));
      const old = deferred<PlaybackSnapshot>(),
        fresh = deferred<PlaybackSnapshot>();
      const poll = updates.poll(() => old.promise);
      const seek = updates.seek(
        async () => {},
        () => fresh.promise,
      );
      updates.push(snapshot(10010)); // queued pre-seek push during IPC
      await Promise.resolve();
      expect(values).toEqual([10000]);
      fresh.resolve(snapshot(target));
      await seek;
      old.resolve(snapshot(10020));
      await poll;
      expect(values).toEqual([10000, target]);
    }
  });
  it("rejects old polls after push updates and older seek acknowledgements", async () => {
    const updates = new PlaybackUpdates(),
      values: number[] = [];
    updates.add((s) => values.push(s.positionMs));
    const old = deferred<PlaybackSnapshot>();
    const poll = updates.poll(() => old.promise);
    updates.push(snapshot(12000));
    old.resolve(snapshot(10000));
    await poll;
    const first = deferred<PlaybackSnapshot>();
    const seek1 = updates.seek(
      async () => {},
      () => first.promise,
    );
    await Promise.resolve();
    await updates.seek(
      async () => {},
      async () => snapshot(12500),
    );
    first.resolve(snapshot(11500));
    await seek1;
    expect(values).toEqual([12000, 12500]);
  });
  it("recovers from failed seeks and stops publishing after unsubscribe", async () => {
    const updates = new PlaybackUpdates(),
      values: number[] = [];
    const remove = updates.add((s) => values.push(s.positionMs));
    await expect(
      updates.seek(
        async () => {
          throw Error("output lost");
        },
        async () => snapshot(0),
      ),
    ).rejects.toThrow("output lost");
    await updates.poll(async () => snapshot(500));
    remove();
    updates.push(snapshot(600));
    expect(values).toEqual([500]);
  });
});
