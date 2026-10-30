import type { Track } from "../types";
import { normalizeSearch } from "./match";

/** One active catalog index and at most 32 recent queries, without audio/blobs. */
export class CatalogMatcher {
  private worker?: Worker;
  private generation: string | number = -1;
  private sequence = 0;
  private pending = new Map<
    number,
    {
      resolve: (ids: Map<string, number>) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private cache = new Map<string, Promise<Map<string, number>>>();
  private fail = (message: string) => {
    this.worker?.terminate();
    this.worker = undefined;
    this.generation = -1;
    this.cache.clear();
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error(message));
    }
    this.pending.clear();
  };
  match(
    tracks: Pick<Track, "id" | "title" | "artist" | "album">[],
    generation: string | number,
    query: string,
  ): Promise<Map<string, number>> {
    const key = JSON.stringify([generation, normalizeSearch(query)]);
    const cached = this.cache.get(key);
    if (cached) return cached;
    if (!this.worker) {
      this.worker = new Worker(
        new URL("./catalog.worker.ts", import.meta.url),
        { type: "module" },
      );
      this.worker.onerror = () =>
        this.fail("Search is unavailable. Please retry.");
      this.worker.onmessage = (
        event: MessageEvent<{
          id: number;
          scores?: Array<[string, number]>;
          error?: string;
        }>,
      ) => {
        const request = this.pending.get(event.data.id);
        if (!request) return;
        clearTimeout(request.timer);
        this.pending.delete(event.data.id);
        if (event.data.error) request.reject(new Error(event.data.error));
        else request.resolve(new Map(event.data.scores));
      };
    }
    const id = ++this.sequence;
    const result = new Promise<Map<string, number>>((resolve, reject) => {
      const timer = setTimeout(
        () => this.fail("Search timed out. Please retry."),
        5000,
      );
      this.pending.set(id, { resolve, reject, timer });
      const rows =
        generation !== this.generation
          ? tracks.map(({ id, title, artist, album }) => ({
              id,
              title,
              artist,
              album,
            }))
          : undefined;
      this.generation = generation;
      this.worker!.postMessage({ id, rows, query });
    });
    this.cache.set(key, result);
    if (this.cache.size > 32)
      this.cache.delete(this.cache.keys().next().value!);
    void result.catch(() => this.cache.delete(key));
    return result;
  }
}
