import { X } from "lucide-react";
import { api } from "../api";
import { IconButton } from "../components";
import { useMusicAppContext } from "./MusicAppContext";

export default function SelectionToolbar() {
  const {
    query,
    setNotice,
    setModal,
    setCatalogRevision,
    selectedIds,
    setSelectedIds,
    setSelectionMode,
    setActionIds,
    t,
    act,
    remember,
    refresh,
    share,
    shareLabel,
    sharing,
    visible,
    section,
    playlistTracks,
  } = useMusicAppContext();

  return (
    <div className="selection-toolbar" role="region" aria-label={t.selectSongs}>
      <strong aria-live="polite" aria-atomic="true">
        {selectedIds.length} {t.selected}
      </strong>
      <button
        className="text-button"
        onClick={() =>
          setSelectedIds(
            (section === "playlists" ? playlistTracks : visible).map(
              (track) => track.id,
            ),
          )
        }
      >
        {t.selectAll}
      </button>
      <button
        className="text-button"
        disabled={!selectedIds.length}
        onClick={() => void act(() => api.play(selectedIds))}
      >
        {t.play}
      </button>
      <button
        className="text-button"
        disabled={!selectedIds.length}
        onClick={() => {
          setActionIds(selectedIds);
          setModal("add");
        }}
      >
        {t.addToPlaylist}
      </button>
      <button
        className="text-button"
        disabled={!selectedIds.length}
        onClick={() =>
          void act(async () => {
            for (const id of selectedIds) await api.setFavorite(id, true);
            remember(await api.tracksById(selectedIds));
            await refresh(query);
            setCatalogRevision((v) => v + 1);
            setNotice(t.done);
          })
        }
      >
        {t.favorite}
      </button>
      <button
        className="text-button"
        disabled={!selectedIds.length || sharing}
        onClick={() => void share(selectedIds)}
      >
        {shareLabel}
      </button>
      <button
        className="text-button"
        disabled={!selectedIds.length}
        onClick={() => {
          setActionIds(selectedIds);
          setModal("remove");
        }}
      >
        {t.removeLibrary}
      </button>
      <IconButton
        label={t.close}
        onClick={() => {
          setSelectionMode(false);
          setSelectedIds([]);
        }}
      >
        <X />
      </IconButton>
    </div>
  );
}
