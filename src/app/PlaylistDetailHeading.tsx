import { ArrowLeft } from "lucide-react";
import { useMusicAppContext } from "./MusicAppContext";

export default function PlaylistDetailHeading() {
  const {
    selectedList,
    setSelectedList,
    editingList,
    setEditingList,
    t,
    inlineSearch,
    settings,
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
      <span
        className="playlist-detail-meta"
        aria-busy={inlineSearch.active && inlineSearch.pending}
      >
        {inlineSearch.active && inlineSearch.page ? (
          t.searchHeadingCount
            .replace(
              "{count}",
              inlineSearch.page.total.toLocaleString(settings?.language),
            )
            .replace(
              "{collection}",
              formatMusicCount(inlineSearch.page.allTotal),
            )
        ) : (
          <>
            {formatMusicCount(playlistTracks.length)} ·{" "}
            {Math.round(
              playlistTracks.reduce((s, x) => s + x.durationMs, 0) / 60000,
            )}{" "}
            {t.minutes.toLowerCase()}
          </>
        )}
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
