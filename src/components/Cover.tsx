import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type RefObject,
} from "react";
import { coverUrl, hash } from "../domain";
import { api, native } from "../api";
import { type Track } from "../types";

const largeCoverCache = new Map<string, string>();
const largeCoverRequests = new Map<string, Promise<string>>();
function largeCover(key: string, id: string): Promise<string> {
  const cached = largeCoverCache.get(key);
  if (cached) return Promise.resolve(cached);
  const pending = largeCoverRequests.get(key);
  if (pending) return pending;
  const request = api
    .cover(id, 512)
    .then(
      async (url) => {
        const decoded = new Image();
        decoded.src = url;
        await decoded.decode();
        largeCoverRequests.delete(key);
        largeCoverCache.set(key, url);
        while (largeCoverCache.size > 32) {
          largeCoverCache.delete(largeCoverCache.keys().next().value!);
        }
        return url;
      },
      (error) => {
        largeCoverRequests.delete(key);
        throw error;
      },
    )
    .finally(() => largeCoverRequests.delete(key));
  largeCoverRequests.set(key, request);
  return request;
}
export function Cover({
  track,
  className = "",
  large = false,
  imageRef,
}: {
  track: Track;
  className?: string;
  large?: boolean;
  imageRef?: RefObject<HTMLImageElement | null>;
}) {
  const image = useRef<HTMLImageElement>(null);
  const bindImage = useCallback(
    (node: HTMLImageElement | null) => {
      image.current = node;
      if (imageRef) imageRef.current = node;
    },
    [imageRef],
  );
  const key = track.id + ":" + hash(track.artworkUrl ?? "");
  const [resolved, setResolved] = useState<{ key: string; url: string } | null>(
    null,
  );
  useEffect(() => {
    if (!large || !native || !image.current) return;
    let active = true;
    const element = image.current;
    const load = () => {
      void largeCover(key, track.id)
        .then((url) => {
          if (active) setResolved({ key, url });
        })
        .catch(() => {
          /* the existing image or geometric fallback stays visible */
        });
    };
    if (typeof IntersectionObserver === "undefined") load();
    else {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            observer.disconnect();
            load();
          }
        },
        { rootMargin: "240px" },
      );
      observer.observe(element);
      return () => {
        active = false;
        observer.disconnect();
      };
    }
    return () => {
      active = false;
    };
  }, [large, key, track.id]);
  return (
    <img
      ref={bindImage}
      className={"cover " + className}
      src={
        large
          ? ((resolved?.key === key
              ? resolved.url
              : largeCoverCache.get(key)) ?? coverUrl(track))
          : coverUrl(track)
      }
      alt=""
      loading="lazy"
      decoding="async"
      onError={(e) => {
        const fallback = coverUrl({ ...track, artworkUrl: undefined });
        if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
      }}
    />
  );
}
