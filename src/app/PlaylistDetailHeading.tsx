import { ArrowLeft } from "lucide-react";
import { useMusicAppContext } from "./MusicAppContext";

export default function PlaylistDetailHeading() {
  const {
    selectedList,
    setSelectedList,
    editingList,
    setEditingList,
    t,
    formatMusicCount,
    saveList,
    allPlaylistTracks: playlistTracks,
    setSelectionMode,
    setSelectedIds,
  } = useMusicAppContext();

  if (!selectedList) return null;
  return (
    <div className="playlist-detail-head">
      <button
        className="text-button"
        onClick={() => {
          setSelectedList(null);
          setEditingList(false);
        }}
      >
        <ArrowLeft size={18} />
        {t.playlists}
      </button>
      <span className="playlist-detail-meta">
        {formatMusicCount(playlistTracks.length)} ·{" "}
        {Math.round(
          playlistTracks.reduce((s, x) => s + x.durationMs, 0) / 60000,
        )}{" "}
        {t.minutes.toLowerCase()}
      </span>
      {selectedList.kind !== "automatic" && (
        <button
          className="text-button"
          onClick={() => {
            setSelectionMode(false);
            setSelectedIds([]);
            if (editingList) void saveList(selectedList);
            setEditingList(!editingList);
          }}
        >
          {editingList ? t.savePlaylist : t.editPlaylist}
        </button>
      )}
    </div>
  );
}
