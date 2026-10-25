import { Heart, ListMusic, MoreHorizontal } from "lucide-react";
import { useMusicAppContext } from "./MusicAppContext";

export default function PlayerTrackActions({
  view,
}: {
  view: "player" | "queue";
}) {
  const { current, favorite, menu, setMenu, setModal, t } =
    useMusicAppContext();
  if (!current) return null;
  const queueLabel = view === "queue" ? t.nowPlaying : t.queue;
  return (
    <div className="player-track-actions" role="group" aria-label={t.actions}>
      <button
        type="button"
        className={"icon-button" + (view === "queue" ? " active" : "")}
        aria-label={queueLabel}
        title={queueLabel}
        aria-pressed={view === "queue"}
        onClick={() => setModal(view === "queue" ? "player" : "queue")}
      >
        <ListMusic size={24} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={"icon-button" + (current.favorite ? " active" : "")}
        aria-label={t.favorite}
        title={t.favorite}
        aria-pressed={current.favorite}
        onClick={() => void favorite(current)}
      >
        <Heart
          size={24}
          fill={current.favorite ? "currentColor" : "none"}
          aria-hidden="true"
        />
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label={t.actions}
        title={t.actions}
        aria-haspopup="menu"
        aria-expanded={
          menu?.track.id === current.id &&
          menu.anchor.closest(".player-track-actions") !== null
        }
        onClick={(event) =>
          setMenu({ track: current, anchor: event.currentTarget })
        }
      >
        <MoreHorizontal size={24} aria-hidden="true" />
      </button>
    </div>
  );
}
