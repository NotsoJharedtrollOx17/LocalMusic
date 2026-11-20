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
  priority = false,
}: {
  track: Track;
  className?: string;
  large?: boolean;
  imageRef?: RefObject<HTMLImageElement | null>;
  size?: 128 | 256 | 512;
  priority?: boolean;
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
  const android = document.documentElement.dataset.platform === "android";
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
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const url = lazySource
    ? (resolved?.key === key ? resolved.url : cachedArtwork(key)) ??
      (android && priority && pixels > 128 ? cachedArtwork(identity + ":128") : undefined) ??
      (android && failedKey !== key ? undefined : fallback)
    : fallback;
  useEffect(() => {
    if (!lazySource || !image.current) return;
    const unwatch = watchArtwork(key);
    let release: (() => void) | undefined;
    const visible =
      !priority && typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting))
              release ??= pinArtwork(key, priority);
            else {
              release?.();
              release = undefined;
            }
          })
        : null;
    visible?.observe(image.current);
    if (!visible || priority) release = pinArtwork(key, priority);
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
          if (active) setFailedKey(key);
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
      if (priority) load();
      else observer.observe(element);
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
  }, [lazySource, key, track.id, pixels, priority]);
  return (
    <img
      ref={bindImage}
      className={"cover " + className}
      src={url}
      data-artwork-pending={url === undefined || undefined}
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
