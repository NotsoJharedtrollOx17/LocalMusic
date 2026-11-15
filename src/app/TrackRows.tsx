import TrackList from "../TrackList";
import { api } from "../api";
import { TrackRow } from "../components";
import { type Track } from "../types";
import { useMusicAppContext } from "./MusicAppContext";

export default function TrackRows({
  ts,
  queueIds = ts.map((x) => x.id),
  editable,
  numbered,
}: {
  ts: Track[];
  queueIds?: string[];
  editable?: boolean;
  numbered?: boolean;
}) {
  const {
    group,
    player,
    selectedList,
    savingPlaylistId,
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
            hideArtist={group?.kind === "artists" && !editable}
            hideAlbum={group?.kind === "albums" && !editable}
            index={editable || numbered ? i : undefined}
            playing={player.trackId === track.id && player.playing}
            current={player.trackId === track.id}
            onToggle={() => void act(() => api.toggle())}
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
                    up:
                      i && savingPlaylistId !== selectedList?.id
                        ? () =>
                            moveList(
                              i,
                              -1,
                              ts.map((t) => t.id),
                            )
                        : undefined,
                    down:
                      i < ts.length - 1 && savingPlaylistId !== selectedList?.id
                        ? () =>
                            moveList(
                              i,
                              1,
                              ts.map((t) => t.id),
                            )
                        : undefined,
                    remove:
                      savingPlaylistId === selectedList?.id
                        ? undefined
                        : () => {
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
