import { ArrowLeft } from "lucide-react";
import { useMusicAppContext } from "./MusicAppContext";

export default function PlaylistDetailHeading() {
  const {
    selectedList,
    setSelectedList,
    editingList,
    setEditingList,
    t,
    saveList,
    playlistTracks,
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
      <span>
        {playlistTracks.length} {t.tracks} ·{" "}
        {Math.round(
          playlistTracks.reduce((s, x) => s + x.durationMs, 0) / 60000,
        )}{" "}
        {t.minutes.toLowerCase()}
      </span>
      <button
        className="text-button"
        onClick={() => {
          if (editingList) void saveList(selectedList);
          setEditingList(!editingList);
        }}
      >
        {editingList ? t.save : t.edit}
      </button>
    </div>
  );
}
