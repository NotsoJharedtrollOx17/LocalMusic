import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type RefObject,
} from "react";
import { coverUrl, hash } from "../domain";
import { native } from "../api";
import { type Track } from "../types";

import {
  cachedArtwork,
  loadArtwork,
  pinArtwork,
  watchArtwork,
} from "./artworkCache";
export function Cover({
  track,
  className = "",
  large = false,
  imageRef,
  size,
}: {
  track: Track;
  className?: string;
  large?: boolean;
  imageRef?: RefObject<HTMLImageElement | null>;
  size?: 128 | 256 | 512;
}) {
  const image = useRef<HTMLImageElement>(null);
  const bindImage = useCallback(
    (node: HTMLImageElement | null) => {
      image.current = node;
      if (imageRef) imageRef.current = node;
    },
    [imageRef],
  );
  const pixels = size ?? (large ? 512 : 128);
  const lazySource = native || track.artworkUrl?.startsWith("catalog:");
  const identity = track.artworkUrl?.startsWith("cache:")
    ? track.artworkUrl
    : track.id + ":" + hash(track.artworkUrl ?? "");
  const key = identity + ":" + pixels;
  const fallback = lazySource
    ? coverUrl({ ...track, artworkUrl: undefined })
    : coverUrl(track);
  const [resolved, setResolved] = useState<{ key: string; url: string } | null>(
    null,
  );
  useEffect(() => {
    if (!lazySource || !image.current) return;
    const unwatch = watchArtwork(key);
    let release: (() => void) | undefined;
    const visible =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting))
              release ??= pinArtwork(key);
            else {
              release?.();
              release = undefined;
            }
          })
        : null;
    visible?.observe(image.current);
    if (!visible) release = pinArtwork(key);
    const unpin = () => {
      visible?.disconnect();
      release?.();
      unwatch();
    };
    let active = true;
    const element = image.current;
    const load = () => {
      void loadArtwork(key, track.id, pixels)
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
        { rootMargin: `${Math.min(innerHeight * 2, 1800)}px` },
      );
      observer.observe(element);
      return () => {
        active = false;
        observer.disconnect();
        unpin();
      };
    }
    return () => {
      active = false;
      unpin();
    };
  }, [lazySource, key, track.id, pixels]);
  return (
    <img
      ref={bindImage}
      className={"cover " + className}
      src={
        lazySource
          ? ((resolved?.key === key ? resolved.url : cachedArtwork(key)) ??
            fallback)
          : coverUrl(track)
      }
      alt=""
      loading="eager"
      decoding="async"
      onError={(e) => {
        const fallback = coverUrl({ ...track, artworkUrl: undefined });
        if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
      }}
    />
  );
}
