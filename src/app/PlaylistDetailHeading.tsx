import { ArrowLeft } from "lucide-react";
import { useMusicAppContext } from "./MusicAppContext";
import { useEffect, useRef, useState } from "react";
import { useInteractionScope } from "../ux/useInteractionScope";

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
    setSavingPlaylistId,
  } = useMusicAppContext();
  const writing = useRef(false);
  const [saving, setSaving] = useState(false);
  const capture = useInteractionScope(selectedList?.id);
  useEffect(() => {
    const id = selectedList?.id;
    return () =>
      setSavingPlaylistId((current) => (current === id ? null : current));
  }, [selectedList?.id, setSavingPlaylistId]);

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
          disabled={saving}
          aria-busy={saving}
          onClick={() => {
            if (writing.current) return;
            setSelectionMode(false);
            setSelectedIds([]);
            if (!editingList) {
              setEditingList(true);
              return;
            }
            writing.current = true;
            setSaving(true);
            setSavingPlaylistId(selectedList.id);
            const current = capture();
            void saveList(selectedList)
              .then((saved) => {
                if (saved && current()) setEditingList(false);
              })
              .finally(() => {
                writing.current = false;
                if (current()) {
                  setSaving(false);
                  setSavingPlaylistId(null);
                }
              });
          }}
        >
          {editingList ? t.savePlaylist : t.editPlaylist}
        </button>
      )}
    </div>
  );
}
