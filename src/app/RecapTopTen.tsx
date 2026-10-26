import { useRef, useState } from "react";
import { Play, Plus } from "lucide-react";
import { api } from "../api";
import { periodLabel } from "../recap/periods";
import { useMusicAppContext } from "./MusicAppContext";
import TrackRows from "./TrackRows";

export default function RecapTopTen() {
  const { recap, cache, settings, t, act, refreshLists, setNotice } =
    useMusicAppContext();
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  if (!recap) return null;
  const tracks = recap.topTracks.slice(0, 10).map((x) => ({
    ...x.track,
    available: cache[x.track.id]?.available ?? x.track.available,
    hidden: cache[x.track.id]?.hidden ?? x.track.hidden,
  }));
  const ids = tracks.filter((t) => t.available && !t.hidden).map((t) => t.id);
  return (
    <section className="recap-track-list" aria-label={t.recapTopTen}>
      <div className="recap-playlist-heading">
        <h2>{t.recapTopTen}</h2>
        <div>
          <button
            className="button primary"
            disabled={!ids.length}
            onClick={() => void act(() => api.play(ids))}
          >
            <Play size={18} />
            {t.playTopTen}
          </button>
          <button
            className="button secondary"
            disabled={!ids.length || saving}
            aria-busy={saving}
            onClick={() => {
              if (pending.current) return;
              pending.current = true;
              setSaving(true);
              void act(async () => {
                await api.savePlaylist({
                  id: crypto.randomUUID(),
                  title: `${t.recapTopTen} · ${periodLabel(recap.period, settings?.language)}`,
                  kind: "manual",
                  trackIds: ids,
                });
                await refreshLists();
                setNotice(t.playlistSaved);
              }).finally(() => {
                pending.current = false;
                setSaving(false);
              });
            }}
          >
            <Plus size={18} />
            {t.savePlaylist}
          </button>
        </div>
      </div>
      {!!tracks.length && <TrackRows ts={tracks} queueIds={ids} numbered />}
    </section>
  );
}
