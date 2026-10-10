import { Play } from "lucide-react";
import { api } from "../api";
import { useMusicAppContext } from "./MusicAppContext";

export default function PlaylistDetailActions() {
  const {
    selectedList,
    setSelectedList,
    t,
    act,
    refreshLists,
    playlistTracks,
  } = useMusicAppContext();

  if (!selectedList) return null;
  return (
    <div className="playlist-footer">
      <button
        className="button primary"
        disabled={!playlistTracks.length}
        onClick={() => void act(() => api.play(selectedList.trackIds))}
      >
        <Play size={18} />
        {t.playMix}
      </button>
      <button
        className="text-button danger"
        onClick={() =>
          void act(async () => {
            if (confirm(t.delete + " " + selectedList.title + "?")) {
              await api.deletePlaylist(selectedList.id);
              await refreshLists();
              setSelectedList(null);
            }
          })
        }
      >
        {t.delete}
      </button>
    </div>
  );
}
