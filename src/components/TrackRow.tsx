import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, type MouseEvent } from "react";
import {
  Play,
  Pause,
  Heart,
  ArrowUp,
  ArrowDown,
  Trash2,
  Check,
  Circle,
} from "lucide-react";
import { type Track } from "../types";
import { IconButton } from "./IconButton";
import { Cover } from "./Cover";
import { time } from "./format";
import OverflowIcon from "./OverflowIcon";
import { useGestureCancellation } from "../ux/useGestureCancellation";

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
  onMore?: (event: MouseEvent<HTMLElement>) => void;
  onSelect?: (shift?: boolean) => void;
  selected?: boolean;
  selectionMode?: boolean;
  unknownArtist: string;
  labels: {
    play: string;
    favorite: string;
    details: string;
    actions: string;
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
    held = useRef(false),
    touch = useRef(false);
  const cancel = () => {
    if (press.current) clearTimeout(press.current);
    press.current = null;
  };
  useEffect(() => cancel, []);
  const interrupt = () => {
    if (!press.current && !origin.current) return;
    cancel();
    origin.current = null;
    held.current = true;
  };
  useGestureCancellation(interrupt, track.id);
  return (
    <div
      data-track-id={track.id}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        cancel();
        // Android may fire contextmenu before our hold timer, or after pointerup.
        // A touch hold selects once; mouse/keyboard retain the song menu.
        if (
          touch.current ||
          (event.nativeEvent as PointerEvent).pointerType === "touch" ||
          ((event.nativeEvent as PointerEvent).pointerType === "pen" &&
            document.documentElement.dataset.layout === "phone")
        ) {
          if (
            (event.target as Element).closest(".icon-button,.selection-check")
          )
            return;
          if (onSelect && !held.current) {
            held.current = true;
            onSelect();
          }
          return;
        }
        if (!held.current) onMore?.(event);
      }}
      onPointerDown={(e) => {
        if (e.isPrimary === false) {
          interrupt();
          held.current = true;
          return;
        }
        touch.current =
          e.pointerType === "touch" ||
          (e.pointerType === "pen" &&
            document.documentElement.dataset.layout === "phone");
        held.current = false;
        if (
          !touch.current ||
          !onSelect ||
          (e.target as HTMLElement).closest(".icon-button,.selection-check")
        )
          return;
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
          interrupt();
      }}
      onPointerUp={() => {
        cancel();
        origin.current = null;
      }}
      onPointerCancel={interrupt}
      onLostPointerCapture={interrupt}
      onKeyDownCapture={(e) => {
        if (e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) {
          touch.current = false;
          held.current = false;
          cancel();
        }
      }}
      onClickCapture={(e) => {
        if (held.current && e.detail > 0) {
          e.preventDefault();
          e.stopPropagation();
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
          {selected && <Check size={15} strokeWidth={2.5} aria-hidden="true" />}
          {!selected && (
            <Circle className="selection-empty" size={22} aria-hidden="true" />
          )}
        </button>
      )}
      {index !== undefined && (
        <span className="track-number">
          {String(index + 1).padStart(2, "0")}
        </span>
      )}
      <button
        className="track-hit"
        onClick={(e) => {
          if (selectionMode && onSelect) {
            onSelect(e.shiftKey);
            return;
          }
          if (document.documentElement.dataset.platform === "android")
            void invoke("touch_feedback").catch(() => {});
          onPlay();
        }}
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
          <span className="track-meta">
            <span className="track-artist">
              {track.artist || unknownArtist}
            </span>
            <span
              className="track-duration-inline"
              data-duration={
                track.available && !track.hidden ? true : undefined
              }
            >
              {track.hidden
                ? (labels.removedLibrary ?? "Removed from Library")
                : track.available
                  ? time(track.durationMs)
                  : labels.unavailable}
            </span>
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
          <IconButton
            label={labels.moveUp}
            disabled={!edit.up}
            onClick={() => edit.up?.()}
          >
            <ArrowUp size={18} />
          </IconButton>
          <IconButton
            label={labels.moveDown}
            disabled={!edit.down}
            onClick={() => edit.down?.()}
          >
            <ArrowDown size={18} />
          </IconButton>
          <IconButton
            label={labels.remove}
            disabled={!edit.remove}
            onClick={() => edit.remove?.()}
          >
            <Trash2 size={18} />
          </IconButton>
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
            <IconButton
              label={labels.actions + ": " + track.title}
              onClick={onMore}
              hasMenu
            >
              <OverflowIcon />
            </IconButton>
          )}
        </>
      )}
    </div>
  );
}
