import { api } from "../api";
import { coverUrl } from "../domain";
import type { Recap } from "../types";
import { recapRankings, type RankingGroup } from "./rankings";

export interface ExportRankingItem {
  name: string;
  detail: string;
  plays: number;
  image?: HTMLImageElement;
}
export interface ExportRankingGroup {
  key: RankingGroup["key"];
  titleKey: RankingGroup["titleKey"];
  items: ExportRankingItem[];
}

export function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
}

async function bounded<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
  throwIfAborted(signal);
  let timer: ReturnType<typeof setTimeout>;
  let abort: () => void = () => {};
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Artwork loading timed out")),
          5000,
        );
        abort = () =>
          reject(new DOMException("Export cancelled", "AbortError"));
        signal?.addEventListener("abort", abort, { once: true });
      }),
    ]);
  } finally {
    clearTimeout(timer!);
    signal?.removeEventListener("abort", abort);
  }
}

async function decode(url: string, signal?: AbortSignal) {
  throwIfAborted(signal);
  // Cover adapters return local image bytes/URLs; never fetch remote metadata URLs.
  if (!url.startsWith("data:image/") && !url.startsWith("blob:"))
    throw new Error("Non-local cover");
  const image = new Image();
  image.src = url;
  await bounded(image.decode(), signal);
  throwIfAborted(signal);
  return image;
}

export async function prepareRecapRankings(
  recap: Recap,
  signal?: AbortSignal,
  coverSize = 512,
): Promise<ExportRankingGroup[]> {
  throwIfAborted(signal);
  const covers = new Map<string, Promise<HTMLImageElement>>();
  return Promise.all(
    recapRankings(recap).map(async (group) => ({
      key: group.key,
      titleKey: group.titleKey,
      items: await Promise.all(
        group.items.map(async (item) => {
          const { artwork, ...display } = item;
          if (!artwork) return display;
          let pending = covers.get(artwork.id);
          if (!pending) {
            pending = (async () => {
              try {
                const url = artwork.id.startsWith("recap-album:")
                  ? coverUrl(artwork)
                  : await bounded(api.cover(artwork.id, coverSize), signal);
                return await decode(url, signal);
              } catch {
                throwIfAborted(signal);
                try {
                  return await decode(coverUrl(artwork), signal);
                } catch {
                  throwIfAborted(signal);
                  return decode(
                    coverUrl({ ...artwork, artworkUrl: undefined }),
                    signal,
                  );
                }
              }
            })();
            covers.set(artwork.id, pending);
          }
          return { ...display, image: await pending };
        }),
      ),
    })),
  );
}
