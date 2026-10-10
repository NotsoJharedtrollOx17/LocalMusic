import { useEffect, useRef, type MouseEvent } from "react";
import {
  Play,
  Pause,
  Heart,
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
  Trash2,
} from "lucide-react";
import { type Track } from "../types";
import { IconButton } from "./IconButton";
import { Cover } from "./Cover";
import { time } from "./format";

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
  onSelect,
  selected,
  selectionMode,
}: {
  track: Track;
  index?: number;
  playing?: boolean;
  onPlay: () => void;
  onFavorite?: () => void;
  onMore?: (event: MouseEvent<HTMLButtonElement>) => void;
  onSelect?: (shift?: boolean) => void;
  selected?: boolean;
  selectionMode?: boolean;
  unknownArtist: string;
  labels: {
    play: string;
    favorite: string;
    details: string;
    remove: string;
    moveUp: string;
    moveDown: string;
    unavailable: string;
    selectSongs?: string;
    removedLibrary?: string;
  };
  edit?: { up?: () => void; down?: () => void; remove?: () => void };
}) {
  const press = useRef<ReturnType<typeof setTimeout> | null>(null),
    origin = useRef<{ x: number; y: number } | null>(null),
    held = useRef(false);
  const cancel = () => {
    if (press.current) clearTimeout(press.current);
    press.current = null;
  };
  useEffect(() => cancel, []);
  return (
    <div
      onPointerDown={(e) => {
        held.current = false;
        if (
          e.pointerType !== "touch" ||
          !onSelect ||
          (e.target as HTMLElement).closest(".icon-button,.selection-check")
        )
          return;
        held.current = false;
        origin.current = { x: e.clientX, y: e.clientY };
        cancel();
        press.current = setTimeout(() => {
          held.current = true;
          onSelect();
        }, 480);
      }}
      onPointerMove={(e) => {
        if (
          origin.current &&
          Math.hypot(
            e.clientX - origin.current.x,
            e.clientY - origin.current.y,
          ) > 10
        )
          cancel();
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onClickCapture={(e) => {
        if (held.current) {
          e.preventDefault();
          e.stopPropagation();
          held.current = false;
        }
      }}
      className={
        "track-row" +
        (selected ? " is-selected" : "") +
        (playing ? " is-playing" : "") +
        (track.available && !track.hidden ? "" : " unavailable")
      }
    >
      {selectionMode && onSelect && (
        <button
          className="selection-check"
          aria-label={(labels.selectSongs ?? "Select") + " " + track.title}
          aria-pressed={!!selected}
          onClick={(e) => onSelect(e.shiftKey)}
        >
          {selected ? "✓" : "○"}
        </button>
      )}
      {index !== undefined && (
        <span className="track-number">
          {String(index + 1).padStart(2, "0")}
        </span>
      )}
      <button
        className="track-hit"
        onClick={(e) =>
          selectionMode && onSelect ? onSelect(e.shiftKey) : onPlay()
        }
        disabled={(!track.available || track.hidden) && !selectionMode}
        aria-label={
          selectionMode ? track.title : labels.play + " " + track.title
        }
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
          {track.album && (
            <span
              className="album-label"
              title={
                track.album +
                (track.releaseYear ? " · " + track.releaseYear : "")
              }
            >
              {track.album}
              {track.releaseYear ? " · " + track.releaseYear : ""}
            </span>
          )}
        </span>
      </button>
      <span className="track-duration">
        {track.hidden
          ? (labels.removedLibrary ?? "Removed from Library")
          : track.available
            ? time(track.durationMs)
            : labels.unavailable}
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
