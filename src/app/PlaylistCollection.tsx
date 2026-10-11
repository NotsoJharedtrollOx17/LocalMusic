import { ListMusic, ArrowUpRight } from "lucide-react";
import { useMusicAppContext } from "./MusicAppContext";

export default function PlaylistCollection() {
  const { lists, t, openPlaylist, formatMusicCount } = useMusicAppContext();

  return (
    <div className="playlist-collection">
      {lists.map((p) => (
        <button
          key={p.id}
          className="playlist-tile"
          onClick={() => void openPlaylist(p)}
        >
          <div className="playlist-tile-art">
            <ListMusic size={35} />
            <span>{String(p.trackIds.length).padStart(2, "0")}</span>
          </div>
          <div>
            <p className="eyebrow">
              {p.kind === "generated"
                ? t.generated
                : p.kind === "recap"
                  ? t.year
                  : t.manual}
            </p>
            <h3>{p.title}</h3>
            <span>{formatMusicCount(p.trackIds.length)}</span>
          </div>
          <ArrowUpRight size={22} />
        </button>
      ))}
    </div>
  );
}
