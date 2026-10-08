import { useEffect, useRef, type ReactNode } from "react";
import {
  X,
  Play,
  Pause,
  Heart,
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
  Trash2,
} from "lucide-react";
import { coverUrl } from "./domain";
import { drawOrbit } from "./export";
import type { Track } from "./types";
export function IconButton({
  label,
  onClick,
  children,
  active = false,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={"icon-button" + (active ? " active" : "")}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active || undefined}
    >
      {children}
    </button>
  );
}
export const time = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
};
export function Cover({
  track,
  className = "",
}: {
  track: Track;
  className?: string;
}) {
  return (
    <img
      className={"cover " + className}
      src={coverUrl(track)}
      alt=""
      loading="lazy"
      onError={(e) => {
        if (
          e.currentTarget.src !== coverUrl({ ...track, artworkUrl: undefined })
        )
          e.currentTarget.src = coverUrl({ ...track, artworkUrl: undefined });
      }}
    />
  );
}
export function TrackRow({
  track,
  index,
  playing,
  onPlay,
  onFavorite,
  onMore,
  unknownArtist,
  labels,
  edit,
}: {
  track: Track;
  index?: number;
  playing?: boolean;
  onPlay: () => void;
  onFavorite?: () => void;
  onMore?: () => void;
  unknownArtist: string;
  labels: {
    play: string;
    favorite: string;
    details: string;
    remove: string;
    moveUp: string;
    moveDown: string;
    unavailable: string;
  };
  edit?: { up?: () => void; down?: () => void; remove?: () => void };
}) {
  return (
    <div
      className={
        "track-row" +
        (playing ? " is-playing" : "") +
        (track.available ? "" : " unavailable")
      }
    >
      {index !== undefined && (
        <span className="track-number">
          {String(index + 1).padStart(2, "0")}
        </span>
      )}
      <button
        className="track-hit"
        onClick={onPlay}
        disabled={!track.available}
        aria-label={labels.play + " " + track.title}
      >
        <div className="cover-wrap">
          <Cover track={track} />
          <span className="cover-play">
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </span>
        </div>
        <span className="track-copy">
          <strong>{track.title}</strong>
          <span>
            {track.artist || unknownArtist}
            {track.demo && (
              <small className="sample-dot" title="Sample audio">
                {" "}
                · SAMPLE
              </small>
            )}
          </span>
        </span>
      </button>
      <span className="track-duration">
        {track.available ? time(track.durationMs) : labels.unavailable}
      </span>
      {edit ? (
        <div className="row-actions">
          {edit.up && (
            <IconButton label={labels.moveUp} onClick={edit.up}>
              <ArrowUp size={18} />
            </IconButton>
          )}
          {edit.down && (
            <IconButton label={labels.moveDown} onClick={edit.down}>
              <ArrowDown size={18} />
            </IconButton>
          )}
          {edit.remove && (
            <IconButton label={labels.remove} onClick={edit.remove}>
              <Trash2 size={18} />
            </IconButton>
          )}
        </div>
      ) : (
        <>
          {onFavorite && (
            <IconButton
              label={labels.favorite}
              onClick={onFavorite}
              active={track.favorite}
            >
              <Heart
                size={19}
                fill={track.favorite ? "currentColor" : "none"}
              />
            </IconButton>
          )}
          {onMore && (
            <IconButton label={labels.details} onClick={onMore}>
              <MoreHorizontal size={22} />
            </IconButton>
          )}
        </>
      )}
    </div>
  );
}
export function Modal({
  title,
  onClose,
  children,
  wide = false,
  closeLabel = "Close",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  closeLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const node = ref.current!;
    const focusables = () =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          'button,input,select,textarea,[tabindex="0"]',
        ),
      ).filter((e) => !e.hasAttribute("disabled"));
    focusables()[0]?.focus();
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const f = focusables(),
          first = f[0],
          last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.removeEventListener("keydown", listener);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={"modal" + (wide ? " wide" : "")}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <IconButton label={closeLabel} onClick={onClose}>
            <X />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}
export function OrbitPoster({
  year,
  seed,
  label,
}: {
  year: number;
  seed: string;
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!,
      ctx = c.getContext("2d")!;
    c.width = 1000;
    c.height = 480;
    drawOrbit(ctx, 0, 0, 1000, 480, seed);
  }, [seed]);
  return (
    <div className="orbit-poster">
      <canvas ref={ref} aria-hidden="true" />
      <div>
        <strong>{year}</strong>
        <span>{label}</span>
      </div>
      <small>LOCAL MUSIC / YOUR YEAR</small>
    </div>
  );
}
