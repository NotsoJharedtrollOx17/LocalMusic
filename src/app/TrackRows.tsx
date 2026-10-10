import TrackList from "../TrackList";
import { api } from "../api";
import { TrackRow } from "../components";
import { type Track } from "../types";
import { useMusicAppContext } from "./MusicAppContext";

export default function TrackRows({
  ts,
  queueIds = ts.map((x) => x.id),
  editable,
}: {
  ts: Track[];
  queueIds?: string[];
  editable?: boolean;
}) {
  const {
    player,
    selectedList,
    setSelectedList,
    selectedIds,
    selectionMode,
    setMenu,
    t,
    act,
    toggleSelected,
    favorite,
    moveList,
  } = useMusicAppContext();

  return (
    <TrackList
      count={ts.length}
      render={(i) => {
        const track = ts[i];
        return (
          <TrackRow
            key={track.id}
            track={track}
            index={editable ? i : undefined}
            playing={player.trackId === track.id && player.playing}
            unknownArtist={t.unknownArtist}
            labels={t}
            selectionMode={selectionMode && !editable}
            selected={selectedIds.includes(track.id)}
            onSelect={
              !editable && !track.hidden
                ? (shift) =>
                    toggleSelected(
                      track.id,
                      shift,
                      ts.map((t) => t.id),
                    )
                : undefined
            }
            onPlay={() =>
              void act(() =>
                api.play(
                  queueIds.includes(track.id) ? queueIds : [track.id],
                  Math.max(0, queueIds.indexOf(track.id)),
                ),
              )
            }
            onFavorite={() => void favorite(track)}
            onMore={(e) =>
              setMenu({
                track,
                anchor: e.currentTarget,
                point:
                  e.type === "contextmenu" && (e.clientX || e.clientY)
                    ? { x: e.clientX, y: e.clientY }
                    : undefined,
              })
            }
            edit={
              editable
                ? {
                    up: i ? () => moveList(i, -1) : undefined,
                    down: i < ts.length - 1 ? () => moveList(i, 1) : undefined,
                    remove: () => {
                      if (selectedList)
                        setSelectedList({
                          ...selectedList,
                          trackIds: selectedList.trackIds.filter(
                            (id) => id !== track.id,
                          ),
                        });
                    },
                  }
                : undefined
            }
          />
        );
      }}
    />
  );
}
